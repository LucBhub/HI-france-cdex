require("dotenv").config();
const ModbusRTU = require("modbus-serial");
const { ModbusReader, applyScaling } = require("./lib/modbus-utils");

const API_URL = process.env.INTERNAL_API_URL || "http://backend:3001";
const SERVICE_TOKEN = process.env.POLLING_SERVICE_TOKEN;
const MODBUS_PORT = parseInt(process.env.MODBUS_PORT || "502", 10);
const MODBUS_TIMEOUT_MS = parseInt(process.env.MODBUS_TIMEOUT_MS || "2000", 10);
const DEFAULT_MODBUS_UNIT_ID = parseInt(
  process.env.MODBUS_DEFAULT_UNIT_ID || "1",
  10,
);

if (!SERVICE_TOKEN)
  console.warn("[Polling Service] POLLING_SERVICE_TOKEN is not set.");

let deviceModels = {};
let lastHistorization = {};

function getRelayUnitId(relay) {
  return relay &&
    typeof relay.unitId !== "undefined" &&
    !Number.isNaN(Number(relay.unitId))
    ? Number(relay.unitId)
    : DEFAULT_MODBUS_UNIT_ID;
}

async function fetchDeviceModels() {
  try {
    const response = await fetch(`${API_URL}/api/device-models`, {
      headers: SERVICE_TOKEN ? { "X-Service-Token": SERVICE_TOKEN } : undefined,
    });
    if (!response.ok) return;
    const models = await response.json();
    models.forEach((m) => (deviceModels[m.id] = m.config));
  } catch (error) {
    console.error(
      "[Polling Service] Error fetching device models:",
      error.message,
    );
  }
}

async function readDevice(client, modelConfig) {
  try {
    const reader = new ModbusReader(client);
    const results = {};
    const context = {};

    // 1. Nominal Values
    if (modelConfig.nominal) {
      for (const [key, param] of Object.entries(modelConfig.nominal)) {
        const val = await reader.readValue(param);
        if (val !== null) context[key] = applyScaling(val, param);
      }
      if (!context.Pn && context.unp && context.inp) {
        context.Pn = Math.sqrt(3) * context.unp * context.inp;
      }
    }

    // Helper to get base context for scaling
    const getBase = (key) =>
      context[key] || (key === "inp" ? context.in_nom : context.un_nom) || 1;

    // 2. Measurements
    if (modelConfig.measurements) {
      const m = modelConfig.measurements;

      // Currents
      if (m.currents) {
        const vals = await reader.readBlock(m.currents, 3);
        // Handle spacing hack manually if readBlock didn't (readBlock naive implementation doesn't support spacing yet)
        // Actually my readBlock implementation splits strictly.
        // If spacing exists (register skipping), readBlock might return garbage for L2/L3.
        // Re-implement specific block reading here safely using reader.client and reader.parseBuffer?
        // For now, let's trust readBlock works for standard contiguous.
        // IF spacing is needed, existing code handled it.
        // Let's stick to the manual read approach using reader.parseBuffer to be 100% safe and versatile

        // RE-IMPLEMENTATION for safety matching original logic:
        const conf = m.currents;
        try {
          const data = await client.readInputRegisters(
            conf.address,
            conf.length,
          );
          let rawL1, rawL2, rawL3;
          const buf = data.buffer;

          if (conf.type === "uword" && conf.spacing && buf.length >= 10) {
            rawL1 = buf.readUInt16BE(0);
            rawL2 = buf.readUInt16BE(4);
            rawL3 = buf.readUInt16BE(8);
          } else {
            // Use generic split
            const step = (conf.length / 3) * 2; // bytes
            if (buf.length >= step * 3) {
              const itemConf = { ...conf, length: step / 2 };
              rawL1 = reader.parseBuffer(buf.slice(0, step), itemConf);
              rawL2 = reader.parseBuffer(buf.slice(step, step * 2), itemConf);
              rawL3 = reader.parseBuffer(
                buf.slice(step * 2, step * 3),
                itemConf,
              );
            }
          }

          const base = getBase("inp");
          results.currentL1 = applyScaling(rawL1, conf, base);
          results.currentL2 = applyScaling(rawL2, conf, base);
          results.currentL3 = applyScaling(rawL3, conf, base);
        } catch (e) { }
      }

      // Voltages
      if (m.voltages) {
        const conf = m.voltages;
        try {
          const data = await client.readInputRegisters(
            conf.address,
            conf.length,
          );
          // Similar logic, no spacing usually for voltages but let's be generic
          const step = (conf.length / 3) * 2;
          let rawL1, rawL2, rawL3;

          if (data.buffer.length >= step * 3) {
            const itemConf = { ...conf, length: step / 2 };
            rawL1 = reader.parseBuffer(data.buffer.slice(0, step), itemConf);
            rawL2 = reader.parseBuffer(
              data.buffer.slice(step, step * 2),
              itemConf,
            );
            rawL3 = reader.parseBuffer(
              data.buffer.slice(step * 2, step * 3),
              itemConf,
            );
          }

          // WORKAROUND: Thytronic bug L3
          const isBugged =
            (!conf.type || conf.type === "long_swap") &&
            rawL3 >= 65530 &&
            rawL3 < 70000;
          if (isBugged) rawL3 = 0;

          const base = getBase("unp");
          results.voltageL1 = applyScaling(rawL1, conf, base);
          results.voltageL2 = applyScaling(rawL2, conf, base);
          results.voltageL3 = applyScaling(rawL3, conf, base);
        } catch (e) { }
      }

      // Line-to-Line Voltages
      if (m.voltages_ll) {
        const conf = m.voltages_ll;
        try {
          // Specific spacing case for 'long_swap' in original code
          const data = await client.readInputRegisters(
            conf.address,
            conf.length,
          );
          if (conf.type === "long_swap" && conf.spacing) {
            // 32-bit (4 bytes) values at 0, 4, 8 register offsets? No, check original
            // "Read as 32-bit LONG Word Swap with spacing"
            // Original code: rawU12 = parseSwappedLong(buf, 0); rawU23 = parseSwappedLong(buf, 4); ...
            // Wait, parseSwappedLong reads 4 bytes. If offset 0, 4, 8, it IS contiguous. 0-4, 4-8, 8-12.
            // So standard parsing works.

            const step = 4; // 32-bit = 4 bytes
            const itemConf = { ...conf, length: 2 }; // 2 registers

            const rawU12 = reader.parseBuffer(
              data.buffer.slice(0, 4),
              itemConf,
            );
            const rawU23 = reader.parseBuffer(
              data.buffer.slice(4, 8),
              itemConf,
            );
            const rawU31 = reader.parseBuffer(
              data.buffer.slice(8, 12),
              itemConf,
            );

            const base = context.unp || 20000;
            results.voltageU12 = applyScaling(rawU12, conf, base);
            results.voltageU23 = applyScaling(rawU23, conf, base);
            results.voltageU31 = applyScaling(rawU31, conf, base);
          }
        } catch (e) { }
      }

      // Frequency
      if (m.frequency) {
        const val = await reader.readValue(m.frequency);
        if (val !== null) results.frequency = applyScaling(val, m.frequency);
      }

      // Power
      if (m.powers) {
        const conf = m.powers;
        try {
          const data = await client.readInputRegisters(
            conf.address,
            conf.length,
          );
          const step = (conf.length / 3) * 2;
          const itemConf = { ...conf, length: step / 2 };

          const rawActive = reader.parseBuffer(
            data.buffer.slice(0, step),
            itemConf,
          );
          const rawReactive = reader.parseBuffer(
            data.buffer.slice(step, step * 2),
            itemConf,
          );
          const rawApparent = reader.parseBuffer(
            data.buffer.slice(step * 2, step * 3),
            itemConf,
          );

          // Power scaling is specific (Pn vs default scale)
          // Original logic: if (scale) ... else if (pn) factor = pn/1000/kv ... else scale 0.001
          const kv = conf.kv || 3000000;
          const pn = context.Pn;

          let factor = conf.scale || 0.001;
          // Favor Pn calculation if both Pn and Kv are explicitly available for the model.
          if (pn && conf.kv) {
            factor = pn / 1000 / conf.kv;
          } else if (!conf.scale && pn) {
            factor = pn / 1000 / kv;
          }

          results.activePower = rawActive * factor;
          results.reactivePower = rawReactive * factor;
          results.apparentPower = rawApparent * factor;
        } catch (e) { }
      }
    }

    // 3. Breaker Status
    if (modelConfig.breakerStatus) {
      const b = modelConfig.breakerStatus;
      let status = false;
      try {
        if (b.input) {
          const r = await client.readInputRegisters(b.input, 1);
          status = r.data[0] === 1;
        } else if (b.discrete) {
          const r = await client.readDiscreteInputs(b.discrete, 1);
          status = r.data[0];
        } else if (b.holding) {
          const r = await client.readHoldingRegisters(b.holding, 1);
          status = r.data[0] === 1;
        }
      } catch (e) { }
      if (b.invert) status = !status;
      results.breakerStatus = status;
    }

    return results;
  } catch (error) {
    console.error("Error reading device measurements:", error.message);
    return null;
  }
}

async function fetchPlants() {
  try {
    const response = await fetch(`${API_URL}/api/plants`, {
      headers: SERVICE_TOKEN ? { "X-Service-Token": SERVICE_TOKEN } : undefined,
    });
    return response.ok ? await response.json() : [];
  } catch (error) {
    console.error("[Polling Service] Error fetching plants:", error.message);
    return [];
  }
}

async function updateRelayMeasurements(relayId, measurements) {
  try {
    await fetch(`${API_URL}/api/relays/${relayId}/measurements`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        ...(SERVICE_TOKEN ? { "X-Service-Token": SERVICE_TOKEN } : {}),
      },
      body: JSON.stringify(measurements),
    });
  } catch (e) {
    console.error(
      `[Polling Service] Error updating relay ${relayId}:`,
      e.message,
    );
  }
}

async function savePlantMeasurement(plant, measurements) {
  try {
    await fetch(`${API_URL}/api/plants/${plant.id}/measurements`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(SERVICE_TOKEN ? { "X-Service-Token": SERVICE_TOKEN } : {}),
      },
      body: JSON.stringify({
        power_kw: measurements.powerOutput || 0,
        voltage_v: measurements.voltageL1 || 0,
        current_a: measurements.currentL1 || 0,
        frequency_hz: measurements.frequency || 0,
        timestamp: new Date().toISOString(),
      }),
    });
    console.log(`[Polling Service] Saved historical data for '${plant.name}'.`);
  } catch (e) {
    console.error(
      `[Polling Service] Error saving history for '${plant.name}':`,
      e.message,
    );
  }
}

async function initHistorizationState() {
  try {
    const plants = await fetchPlants();
    for (const plant of plants) {
      try {
        const res = await fetch(
          `${API_URL}/api/plants/${plant.id}/measurements/latest`,
          {
            headers: SERVICE_TOKEN
              ? { "X-Service-Token": SERVICE_TOKEN }
              : undefined,
          },
        );
        if (res.ok) {
          const data = await res.json();
          if (data.timestamp)
            lastHistorization[plant.id] = new Date(data.timestamp).getTime();
        }
      } catch (e) { }
    }
  } catch (e) {
    console.error(
      "[Polling Service] Failed to init historization state:",
      e.message,
    );
  }
}

async function runPollingCycle() {
  await fetchDeviceModels();
  const plants = await fetchPlants();
  if (!plants.length) return;

  for (const plant of plants) {
    if (!plant.relays || !plant.relays.length) continue;

    let agg = { active: 0, reactive: 0, apparent: 0 };
    let successfulReads = 0;
    let plantLevel = {};

    for (const relay of plant.relays) {
      const client = new ModbusRTU();
      client.on("error", (err) => {
        console.warn(`[Polling Service] Background socket error for ${relay.ipAddress}:`, err.message);
      });
      client.setTimeout(MODBUS_TIMEOUT_MS);

      const config = deviceModels[relay.modelId || "thytronic-xmr-a"];
      if (!config) continue;

      try {
        await client.connectTCP(relay.ipAddress, {
          port: relay.port || MODBUS_PORT,
        });
        client.setID(getRelayUnitId(relay));

        const meas = await readDevice(client, config);
        if (meas) {
          await updateRelayMeasurements(relay.id, meas);

          const active = meas.activePower || 0;
          if (active < 0) {
            // Consumption is usually negative or generation is negative?
            // Original code: if (active < 0) aggregated += active.
            // Assuming generation is negative? Or consumption?
            // Usually solar generation is positive.
            // Original code checks `if (active < 0)`. This implies we only sum negative power?
            // That seems weird for a solar plant unless the meter is inverted.
            // Wait, check original code carefully.
            // "if (active < 0) { aggregatedActive += active; ... }"
            // This implies we ARE summing negative values. Maybe 'consumption' from grid?
            // Or maybe the meter sees export as negative.
            agg.active += active;
            agg.reactive += meas.reactivePower || 0;
            agg.apparent += meas.apparentPower || 0;
          }

          if (successfulReads === 0) plantLevel = meas;
          successfulReads++;
        }
      } catch (e) {
        console.error(
          `[Polling Service] Read error ${relay.ipAddress}:`,
          e.message,
        );
      } finally {
        try {
          client.close();
        } catch (e) { }
      }
    }

    if (successfulReads === 0) continue;

    const updatedPlantData = {
      ...plant,
      powerOutput: Math.abs(Number(agg.active.toFixed(3))),
      activePower: Number(agg.active.toFixed(3)),
      reactivePower: Number(agg.reactive.toFixed(3)),
      apparentPower: Number(agg.apparent.toFixed(3)),
      currentL1: plantLevel.currentL1 || 0,
      currentL2: plantLevel.currentL2 || 0,
      currentL3: plantLevel.currentL3 || 0,
      voltageL1: plantLevel.voltageL1 || 0,
      voltageL2: plantLevel.voltageL2 || 0,
      voltageL3: plantLevel.voltageL3 || 0,
      frequency: plantLevel.frequency || 0,
      lastDataReceived: new Date().toISOString(),
    };
    delete updatedPlantData.relays;

    try {
      await fetch(`${API_URL}/api/plants/${plant.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...(SERVICE_TOKEN ? { "X-Service-Token": SERVICE_TOKEN } : {}),
        },
        body: JSON.stringify(updatedPlantData),
      });
      console.log(
        `[Polling Service] Updated plant '${plant.name}' (Power: ${Math.abs(agg.active).toFixed(3)} kW)`,
      );
    } catch (e) {
      console.error(
        `[Polling Service] Error updating plant '${plant.name}':`,
        e.message,
      );
    }

    // Historization (10 mins)
    const now = Date.now();
    const last = lastHistorization[plant.id] || 0;
    if (now - last >= 600000) {
      // 10 mins
      await savePlantMeasurement(plant, updatedPlantData);
      lastHistorization[plant.id] = now;
    }
  }
}

async function startService() {
  console.log(`[Polling Service] Started. Interval: 60000ms`);
  await initHistorizationState();
  runPollingCycle();
  setInterval(runPollingCycle, 60000);
}

startService();
