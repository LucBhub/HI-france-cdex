/**
 * Fault Reading Service for Thytronic Relays
 *
 * Reads faults from relays via Modbus and stores them in database
 * - Reads every 60 seconds
 * - Detects new faults
 * - Updates fault status (active/resolved)
 * - Auto-cleanup: keeps max 10 faults per relay
 */

const ModbusRTU = require("modbus-serial");
const knex = require("./db/knex");

// Polling interval (60 seconds)
const POLL_INTERVAL = 60000;

// Max faults to keep per relay
const MAX_FAULTS_PER_RELAY = 10;

// Fault type enum mapping (from Thytronic manual) - User-friendly descriptions
const FAULT_TYPES = {
  0: "Défaut non déterminable",
  1: "Court-circuit phase L1 vers terre",
  2: "Court-circuit phase L2 vers terre",
  3: "Court-circuit phase L3 vers terre",
  4: "Court-circuit entre phases L1-L2",
  5: "Court-circuit entre phases L2-L3",
  6: "Court-circuit entre phases L3-L1",
  7: "Court-circuit phases L1-L2 vers terre",
  8: "Court-circuit phases L3-L1 vers terre",
  9: "Court-circuit phases L2-L3 vers terre",
  10: "Court-circuit triphasé L1-L2-L3",
  11: "Court-circuit triphasé vers terre",
};

// Helper functions for parsing Modbus data
function parseLong(buffer, offset) {
  const highWord = buffer.readUInt16BE(offset);
  const lowWord = buffer.readUInt16BE(offset + 2);
  let combined = highWord * 0x10000 + lowWord;
  if (combined > 0x7fffffff) {
    combined -= 0x100000000;
  }
  return combined;
}

function parseULong(buffer, offset) {
  const highWord = buffer.readUInt16BE(offset);
  const lowWord = buffer.readUInt16BE(offset + 2);
  return highWord * 0x10000 + lowWord;
}

function parseSwappedLong(buffer, offset) {
  const lowWord = buffer.readUInt16BE(offset);
  const highWord = buffer.readUInt16BE(offset + 2);
  let combined = highWord * 0x10000 + lowWord;
  if (combined > 0x7fffffff) {
    combined -= 0x100000000;
  }
  return combined;
}

function parseString(buffer, offset, length) {
  let str = "";
  for (let i = 0; i < length * 2; i += 2) {
    const highByte = buffer.readUInt8(offset + i);
    const lowByte = buffer.readUInt8(offset + i + 1);
    if (highByte !== 0) str += String.fromCharCode(highByte);
    if (lowByte !== 0) str += String.fromCharCode(lowByte);
  }
  return str.trim();
}

async function readThytronicFault(
  client,
  faultIndex,
  inp,
  kv_current = 16000,
  kv_voltage = 112000,
) {
  try {
    // Step 1: Write fault index to holding register (4x IDX 9 = address 8)
    await client.writeRegister(8, faultIndex);

    // Step 2: Read fault data from input registers (3x 548-665 = addresses 547-664)
    // Total: 118 registers (236 bytes)
    const data = await client.readInputRegisters(547, 118);

    if (data.buffer.length < 236) {
      console.log(`[Fault Service] Insufficient data for fault ${faultIndex}`);
      return null;
    }

    // Parse fault data according to Thytronic manual
    const faultCounter = parseLong(data.buffer, 0);
    const date = parseString(data.buffer, 4, 6);
    const time = parseString(data.buffer, 16, 6);
    const cause = parseString(data.buffer, 28, 14);

    // Parse currents (ULONG with Kv=16000) - USE SWAPPED LONG (Little Endian Words)
    const rawCurrentL1 = parseSwappedLong(data.buffer, 56);
    const rawCurrentL2 = parseSwappedLong(data.buffer, 60);
    const rawCurrentL3 = parseSwappedLong(data.buffer, 64);

    const currentL1 = (rawCurrentL1 / kv_current) * inp;
    const currentL2 = (rawCurrentL2 / kv_current) * inp;
    const currentL3 = (rawCurrentL3 / kv_current) * inp;

    // Parse voltages (UWORD with Kv=112000) - NOT ULONG!
    const rawVoltageU12 = data.buffer.readUInt16BE(80);
    const rawVoltageU23 = data.buffer.readUInt16BE(84);
    const rawVoltageU31 = data.buffer.readUInt16BE(88);

    // Note: Voltages are in relative units (Un), need Unp for absolute values
    // For now, store raw values / Kv
    const voltageU12 = rawVoltageU12 / kv_voltage;
    const voltageU23 = rawVoltageU23 / kv_voltage;
    const voltageU31 = rawVoltageU31 / kv_voltage;

    // Parse fault type (offset 96 based on empirical testing)
    const faultTypeCode = data.buffer.readUInt16BE(96);
    const faultType = FAULT_TYPES[faultTypeCode] || "Unknown";

    return {
      faultIndex,
      faultCounter,
      date,
      time,
      timestamp: `${date} ${time}`,
      cause,
      currentL1,
      currentL2,
      currentL3,
      voltageU12,
      voltageU23,
      voltageU31,
      faultType,
    };
  } catch (error) {
    console.error(
      `[Fault Service] Error reading fault ${faultIndex}:`,
      error.message,
    );
    return null;
  }
}

// Helper to parse Siemens Time format
function parseSiemensTime(buffer, offset) {
  // 4 registers = 8 bytes
  // Reg 1: Milliseconds
  // Reg 2: High=Hours, Low=Minutes
  // Reg 3: High=Month, Low=Day
  // Reg 4: High=Status, Low=Year
  const ms = buffer.readUInt16BE(offset);
  const hm = buffer.readUInt16BE(offset + 2);
  const md = buffer.readUInt16BE(offset + 4);
  const sy = buffer.readUInt16BE(offset + 6);

  const hours = (hm >> 8) & 0xff;
  const minutes = hm & 0xff;
  const month = (md >> 8) & 0xff;
  const day = md & 0xff;
  const year = 2000 + (sy & 0xff); // Assumption: year is 2-digit

  // Format YYYY-MM-DD
  const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  // Format HH:mm:ss.mss
  const timeStr = `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(Math.floor(ms / 1000)).padStart(2, "0")}`;

  return { date: dateStr, time: timeStr, ms };
}

async function readSiprotecFaults(client, device) {
  try {
    // 1. Check number of unread events (Reg 40601 -> Addr 40600)
    let countReg = await client.readHoldingRegisters(40600, 1);
    let count = countReg.data[0];

    if (count === 0) return []; // No new events

    console.log(
      `[Fault Service] Siprotec ${device.id}: ${count} unread events.`,
    );

    // 2. Read Event Blocks (Max 3 blocks available at 40603 -> Addr 40602)
    // We read 3 blocks * 8 registers = 24 registers
    const eventsData = await client.readHoldingRegisters(40602, 24);
    const buffer = eventsData.buffer;

    // 3. Iterate through up to 3 blocks
    const eventsFound = [];
    const blocksToRead = Math.min(count, 3); // Max 3 per read cycle

    for (let i = 0; i < blocksToRead; i++) {
      const offset = i * 16; // 8 registers * 2 bytes = 16 bytes per block

      // Address matching
      const regAddr = buffer.readUInt16BE(offset + 2);
      const causeType = buffer.readUInt16BE(offset + 4);
      const value = buffer.readUInt16BE(offset + 6);

      // Timestamp (Offset 8)
      const { date, time } = parseSiemensTime(buffer, offset + 8);

      console.log(
        `[Fault Service] Event ${i}: Addr=${regAddr}, Val=${value}, Time=${date} ${time}`,
      );

      // Logic to identify a "Fault" (Trip)
      // We assume specific register addresses correspond to protection Trips.
      // For now, let's capture ALL "Trip" like events.
      // General Trip is often mapped to a specific indication.
      // As a fallback, we treat ANY event with Value=1 (ON) as a potential state change to log,
      // but for "Faults" table we want Trips.

      // Heuristic: If we see a "Trip" signal (usually 'ON' / 1), we fetch fault currents.
      // Using "General Trip" (Reg 511 internal? Mapped somewhere?).
      // Without mapping, we log everything as a "Fault" candidate if it's a "Trip".
      // Let's assume ANY event in the recorder is worth logging for now.

      // Fetch Fault Currents (Last Fault) if it looks like a Trip (Value=1 indicates ON)
      let currentL1 = 0,
        currentL2 = 0,
        currentL3 = 0;

      // Only fetch analog values if this seems to be a new Trip (to avoid fetching for every event)
      // But 40301 holds the LAST fault currents. So we should only fetch if this event IS the last trip.
      // Ideally, we'd match timestamps.

      const stats = await client.readHoldingRegisters(40300, 6); // 40301-40306 -> Addr 40300
      // Scaling 1000.00 kA -> factor 1? No, manual says "1000.00 kA" for 32 bit?
      // "Scaling (100000 corresponds to ...)" -> "1000.00 kA"
      // So 100000 = 1000000A? No 1000.00 kA = 1,000,000 A.
      // So raw 1 = 0.01 kA = 10 A.

      // They are 32-bit values (2 registers each).
      const rawIa = parseLong(stats.buffer, 0); // 40301
      const rawIb = parseLong(stats.buffer, 4); // 40303
      const rawIc = parseLong(stats.buffer, 8); // 40305

      currentL1 = rawIa * 10; // 1 = 0.01kA = 10A
      currentL2 = rawIb * 10;
      currentL3 = rawIc * 10;

      eventsFound.push({
        faultIndex: 0, // No index
        faultCounter: Math.floor(Date.now() / 1000), // Fake counter ID
        date,
        time,
        timestamp: `${date} ${time}`,
        cause: `Event Addr ${regAddr} Val ${value}`,
        currentL1,
        currentL2,
        currentL3,
        voltageU12: 0,
        voltageU23: 0,
        voltageU31: 0,
        faultType: "Event",
      });
    }

    // 4. Acknowledge / Advance Buffer
    // "SOE_Control" at 40602 (Addr 40601).
    // Standard Siemens: Read 40602, toggle Bit 0, Write back.
    const ctrlReg = await client.readHoldingRegisters(40601, 1);
    let ctrlVal = ctrlReg.data[0];
    ctrlVal = ctrlVal ^ 1; // Toggle LSB
    await client.writeRegister(40601, ctrlVal);
    return eventsFound;
  } catch (e) {
    console.error(
      `[Fault Service] Error reading Siprotec faults for ${device.id}:`,
      e.message,
    );
    return [];
  }
}

async function readFaultsFromRelay(device) {
  const client = new ModbusRTU();
  client.on("error", (err) => {
    console.warn(`[Fault Service] Background socket error for ID ${device.id}:`, err.message);
  });

  try {
    console.log(
      `[Fault Service] Reading faults from relay ID ${device.id} (${device.ipAddress}:${device.port})`,
    );

    // Connect to relay
    await client.connectTCP(device.ipAddress, { port: device.port });
    client.setID(device.unitId || 1);
    client.setTimeout(5000);

    let faults = [];

    if (device.modelId === "siprotec-7sj80") {
      // Siprotec Logic
      faults = await readSiprotecFaults(client, device);
    } else {
      // Default / Thytronic Logic
      // Get nominal current (Inp) for scaling
      const dataInp = await client.readInputRegisters(77, 1);
      const inp = dataInp.buffer.readUInt16BE(0);

      // Read the most recent fault (index 0)
      const f = await readThytronicFault(client, 0, inp);
      if (f) faults.push(f);
    }

    for (const fault of faults) {
      if (fault && (fault.faultCounter > 0 || fault.faultType === "Event")) {
        // Check if this fault already exists in database
        // For Siprotec, we use timestamp + cause as unique ID since faultCounter is fake/time-based
        let query = knex("relay_faults").where({ relay_id: device.id });

        if (device.modelId === "siprotec-7sj80") {
          query = query.where({
            timestamp: fault.timestamp,
            cause: fault.cause,
          });
        } else {
          query = query.where({ fault_counter: fault.faultCounter });
        }

        const existing = await query.first();

        // DEBUG: Log what we see
        console.log(
          `[Fault Service] Relay ${device.id} Fault: ${fault.timestamp} - ${fault.cause} (Existing: ${existing ? "YES" : "NO"})`,
        );

        if (!existing) {
          // New fault - insert into database
          console.log(`[Fault Service] New fault detected: ${fault.cause}`);

          await knex("relay_faults").insert({
            relay_id: device.id,
            fault_index: fault.faultIndex,
            fault_counter: fault.faultCounter,
            timestamp: fault.timestamp,
            date: fault.date,
            time: fault.time,
            cause: fault.cause,
            fault_description: fault.cause,
            current_l1: fault.currentL1,
            current_l2: fault.currentL2,
            current_l3: fault.currentL3,
            voltage_u12: fault.voltageU12,
            voltage_u23: fault.voltageU23,
            voltage_u31: fault.voltageU31,
            fault_type: fault.faultType,
            is_active: true,
            acknowledged: false,
          });

          // Auto-cleanup: keep only last 10 faults per relay
          await cleanupOldFaults(device.id);
        }
      }
    }
  } catch (error) {
    console.error(
      `[Fault Service] Error reading from relay ID ${device.id}:`,
      error.message,
    );
  } finally {
    client.close();
  }
}

async function cleanupOldFaults(relayId) {
  try {
    // Get all faults for this relay, ordered by creation date
    const faults = await knex("relay_faults")
      .where({ relay_id: relayId })
      .orderBy("created_at", "desc")
      .select("id");

    if (faults.length > MAX_FAULTS_PER_RELAY) {
      // Delete oldest faults beyond the limit
      const toDelete = faults.slice(MAX_FAULTS_PER_RELAY).map((f) => f.id);

      await knex("relay_faults").whereIn("id", toDelete).del();

      console.log(
        `[Fault Service] Cleaned up ${toDelete.length} old faults for relay ${relayId}`,
      );
    }
  } catch (error) {
    console.error(`[Fault Service] Error cleaning up faults:`, error.message);
  }
}

async function pollAllRelays() {
  try {
    // Get all supported relays
    const relays = await knex("relays")
      .whereIn("modelId", ["thytronic-xmr-a", "siprotec-7sj80"]) // Add siprotec
      .select("*");

    console.log(
      `[Fault Service] Polling ${relays.length} relays for faults...`,
    );

    // Read faults from each relay
    for (const relay of relays) {
      await readFaultsFromRelay(relay);
    }
  } catch (error) {
    console.error("[Fault Service] Error polling relays:", error.message);
  }
}

// Start the fault service
function startFaultService() {
  console.log("[Fault Service] Starting fault monitoring service...");
  console.log(`[Fault Service] Poll interval: ${POLL_INTERVAL / 1000}s`);
  console.log(`[Fault Service] Max faults per relay: ${MAX_FAULTS_PER_RELAY}`);

  // Initial poll
  pollAllRelays();

  // Schedule periodic polling
  setInterval(pollAllRelays, POLL_INTERVAL);
}

module.exports = {
  startFaultService,
  readFaultsFromRelay,
  cleanupOldFaults,
};
