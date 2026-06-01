const express = require("express");
const router = express.Router();
const knex = require("../db/knex");
const authMiddleware = require("../middleware/auth");
const { getCommandRuntimeConfig } = require("../config/runtime");
const { logAudit } = require("../utils/audit-logger");
const { executeCommand } = require("../services/command-service");

function sendLegacyCommandError(res, error) {
  return res.status(error.status || 500).json({
    success: false,
    dryRun: true,
    code: error.code || "command_error",
    message: error.message || "Command dry-run failed.",
    ...(error.runId ? { runId: error.runId } : {}),
    ...(error.plannedEvents ? { plannedEvents: error.plannedEvents } : {}),
  });
}

// Helpers
const calculatePlantStatus = (plant) => {
  if (plant.status === "maintenance") return "maintenance";
  const TIMEOUT_MS = 5 * 60 * 1000;
  if (!plant.lastDataReceived) return "offline";
  const lastReceived = new Date(plant.lastDataReceived).getTime();
  return Date.now() - lastReceived < TIMEOUT_MS ? "online" : "offline";
};

const calculateRelayStatus = (relay) => {
  const TIMEOUT_MS = 5 * 60 * 1000;
  if (!relay.lastUpdated) return "offline";
  const lastUpdated = new Date(relay.lastUpdated).getTime();
  return Date.now() - lastUpdated < TIMEOUT_MS ? "online" : "offline";
};

// GET /api/plants
router.get(
  "/",
  authMiddleware(["member", "admin", "superadmin"]),
  async (req, res) => {
    try {
      console.log("[Plants] Fetching all plants...");
      const plants = await knex("plants").select("*");
      console.log(`[Plants] Found ${plants.length} plants.`);

      const relays = await knex("relays").select("*");
      console.log(`[Plants] Found ${relays.length} relays.`);

      const plantsWithRelays = plants.map((plant) => ({
        ...plant,
        relays: relays
          .filter((r) => r.plantId === plant.id)
          .map((relay) => ({
            ...relay,
            status: calculateRelayStatus(relay),
          })),
        status: calculatePlantStatus(plant),
      }));
      res.json(plantsWithRelays);
    } catch (error) {
      console.error("[Plants] Error fetching plants:", error);
      res.status(500).json({
        success: false,
        message: "Error fetching plants.",
        debug: error.message,
        stack: process.env.NODE_ENV !== "production" ? error.stack : undefined,
      });
    }
  },
);

// GET /api/plants/:id
router.get(
  "/:id",
  authMiddleware(["member", "admin", "superadmin"]),
  async (req, res) => {
    try {
      const { id } = req.params;
      const plant = await knex("plants").where({ id }).first();

      if (plant) {
        const relays = await knex("relays").where({ plantId: id });
        plant.relays = relays.map((relay) => ({
          ...relay,
          status: calculateRelayStatus(relay),
        }));
        plant.status = calculatePlantStatus(plant);
        res.json(plant);
      } else {
        res.status(404).json({ success: false, message: "Plant not found." });
      }
    } catch (error) {
      console.error(`Error fetching plant ${req.params.id}:`, error);
      res
        .status(500)
        .json({ success: false, message: "Error fetching plant." });
    }
  },
);

// POST /api/plants
router.post("/", authMiddleware(["admin", "superadmin"]), async (req, res) => {
  try {
    const {
      name,
      status,
      powerKwc,
      gps,
      address,
      ce,
      modemLogin,
      modemPassword,
      acrMerignac,
      deliveryStation,
      departureStation,
      sourceStation,
      card1,
      email, // Add email
      relays = [],
    } = req.body;

    const plantData = {
      name,
      status,
      powerKwc,
      gps,
      address,
      ce,
      modemLogin,
      modemPassword,
      acrMerignac,
      deliveryStation,
      departureStation,
      sourceStation,
      card1,
      email, // Add email
      powerOutput: 0,
      totalEnergy: 0,
      frequency: 0,
      currentL1: 0,
      currentL2: 0,
      currentL3: 0,
      voltageU12: 0,
      voltageU23: 0,
      voltageU31: 0,
    };

    let newPlantId;
    await knex.transaction(async (trx) => {
      const [newPlant] = await trx("plants").insert(plantData).returning("*");

      if (!newPlant) throw new Error("Failed to create plant.");
      newPlantId = newPlant.id;

      if (relays.length > 0) {
        const relayData = relays
          .map((relay) => {
            if (!relay) return null;
            if (typeof relay === "string") {
              return {
                plantId: newPlant.id,
                ipAddress: relay,
                port: 502,
                unitId: 1,
                modelId: "thytronic-xmr-a",
              };
            }
            return {
              plantId: newPlant.id,
              ipAddress: relay.ipAddress,
              port: Number(relay.port) || 502,
              unitId: Number(relay.unitId) || 1,
              modelId: relay.modelId || "thytronic-xmr-a",
            };
          })
          .filter((r) => r && r.ipAddress);

        if (relayData.length > 0) {
          await trx("relays").insert(relayData);
        }
      }
    });

    const finalNewPlant = await knex("plants")
      .where({ id: newPlantId })
      .first();
    const finalRelays = await knex("relays").where({ plantId: newPlantId });
    finalNewPlant.relays = finalRelays;

    res.status(201).json({ success: true, plant: finalNewPlant });
  } catch (error) {
    console.error("Error adding plant:", error);
    res.status(500).json({ success: false, message: "Failed to add plant." });
  }
});

// PUT /api/plants/:id
router.put(
  "/:id",
  authMiddleware(["admin", "superadmin", "service_account"]),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { relays, ...plantData } = req.body;

      const updatedCount = await knex("plants").where({ id }).update(plantData);

      if (updatedCount > 0) {
        const updatedPlant = await knex("plants").where({ id }).first();
        res.json({ success: true, plant: updatedPlant });
      } else {
        res.status(404).json({ success: false, message: "Plant not found." });
      }
    } catch (error) {
      console.error(`Error updating plant ${req.params.id}:`, error);
      res
        .status(500)
        .json({ success: false, message: "Error updating plant." });
    }
  },
);

// DELETE /api/plants/:id
router.delete(
  "/:id",
  authMiddleware(["admin", "superadmin"]),
  async (req, res) => {
    try {
      const { id } = req.params;
      const deletedCount = await knex("plants").where({ id }).del();
      if (deletedCount > 0) {
        res.json({ success: true });
      } else {
        res.status(404).json({ success: false, message: "Plant not found." });
      }
    } catch (error) {
      console.error(`Error deleting plant ${req.params.id}:`, error);
      res
        .status(500)
        .json({ success: false, message: "Error deleting plant." });
    }
  },
);

// PUT /api/plants/:id/status
router.put(
  "/:id/status",
  authMiddleware(["member", "admin", "superadmin"]),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { status } = req.body;

      if (!["operational", "maintenance"].includes(status)) {
        return res
          .status(400)
          .json({ success: false, message: "Invalid status." });
      }

      const updatedCount = await knex("plants")
        .where({ id })
        .update({ status });

      if (updatedCount > 0) {
        const user = req.user;
        await logAudit({
          userId: user.id,
          username: user.username,
          action: "PLANT_STATUS_CHANGE",
          targetType: "PLANT",
          targetId: id,
          details: `Status changed to ${status}`,
          ipAddress: req.ip,
        });
        res.json({ success: true, status });
      } else {
        res.status(404).json({ success: false, message: "Plant not found." });
      }
    } catch (error) {
      console.error(`Error updating plant status ${req.params.id}:`, error);
      res
        .status(500)
        .json({ success: false, message: "Error updating plant status." });
    }
  },
);

// POST /api/plants/:id/measurements
// Protected: Only service_account (polling service) can write measurements
router.post(
  "/:id/measurements",
  authMiddleware(["service_account"]),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { power_kw, voltage_v, current_a, frequency_hz, timestamp } =
        req.body;

      // Basic validation
      if (!power_kw && !voltage_v && !current_a && !frequency_hz) {
        return res.status(400).json({
          success: false,
          message: "At least one measurement value is required.",
        });
      }

      await knex("measurements").insert({
        plant_id: id,
        power_kw: power_kw || 0,
        voltage_v: voltage_v || 0,
        current_a: current_a || 0,
        frequency_hz: frequency_hz || 0,
        timestamp: timestamp || new Date().toISOString(),
      });

      res.json({ success: true });
    } catch (error) {
      console.error(
        `Error saving measurement for plant ${req.params.id}:`,
        error,
      );
      res
        .status(500)
        .json({ success: false, message: "Failed to save measurement." });
    }
  },
);

// GET /api/plants/:id/measurements
router.get(
  "/:id/measurements",
  authMiddleware(["member", "admin", "superadmin"]),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { start, end, type } = req.query;

      if (!start || !end) {
        return res
          .status(400)
          .json({ error: "Start and End dates are required." });
      }

      let query;
      if (type === "hourly") {
        query = knex("measurements_hourly")
          .where({ plant_id: id })
          .whereBetween("timestamp", [start, end])
          .orderBy("timestamp", "asc");
      } else {
        query = knex("measurements")
          .where({ plant_id: id })
          .whereBetween("timestamp", [start, end])
          .orderBy("timestamp", "asc");
      }

      const data = await query;
      res.json(data);
    } catch (error) {
      console.error(
        `Error fetching measurements for plant ${req.params.id}:`,
        error,
      );
      res
        .status(500)
        .json({ success: false, message: "Failed to fetch measurements." });
    }
  },
);

// GET /api/plants/:id/irradiation
router.get(
  "/:id/irradiation",
  authMiddleware(["member", "admin", "superadmin"]),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { start, end } = req.query;

      if (!start || !end) {
        return res
          .status(400)
          .json({ error: "Start and End dates are required." });
      }

      const data = await knex("irradiation_hourly")
        .where({ plant_id: id })
        .whereBetween("timestamp", [start, end])
        .orderBy("timestamp", "asc");

      res.json(data);
    } catch (error) {
      console.error(
        `Error fetching irradiation for plant ${req.params.id}:`,
        error,
      );
      res
        .status(500)
        .json({ success: false, message: "Failed to fetch irradiation data." });
    }
  },
);

// Relay Control Endpoint
router.post(
  "/:plantId/relays/:relayId/control",
  authMiddleware(["member", "admin", "superadmin"]),
  async (req, res) => {
    const { plantId, relayId } = req.params;
    const { command } = req.body; // 'couple' or 'decouple'

    if (!["couple", "decouple", "reset"].includes(command)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid command. Use "couple", "decouple", or "reset".',
      });
    }

    if (!getCommandRuntimeConfig().commandLiveEnabled) {
      try {
        const dryRun = await executeCommand({
          commandKey: `legacy.relay.${command}`,
          target: { plantId, relayId },
          params: { legacyRoute: true },
          mode: "dry_run",
          user: req.user,
          ipAddress: req.ip,
        });

        return res.json({
          success: true,
          dryRun: true,
          message: dryRun.message,
          messageKey: "command_dry_run",
          breakerClosed: null,
          runId: dryRun.runId,
          status: dryRun.status,
          plannedEvents: dryRun.plannedEvents,
        });
      } catch (error) {
        return sendLegacyCommandError(res, error);
      }
    }

    try {
      // Fetch relay AND its model config
      const relay = await knex("relays")
        .join("device_models", "relays.modelId", "device_models.id")
        .select("relays.*", "device_models.config as modelConfig")
        .where({ "relays.id": relayId, "relays.plantId": plantId })
        .first();

      if (!relay) {
        return res
          .status(404)
          .json({ success: false, message: "Relay not found." });
      }

      let modelConfig = relay.modelConfig;
      if (typeof modelConfig === "string") {
        try {
          modelConfig = JSON.parse(modelConfig);
        } catch (e) {
          return res.status(500).json({
            success: false,
            message: "Invalid device model configuration.",
          });
        }
      }
      if (!modelConfig) {
        return res.status(500).json({
          success: false,
          message: "Device model configuration missing.",
        });
      }

      const ModbusRTU = require("modbus-serial");
      const client = new ModbusRTU();
      const MODBUS_TIMEOUT_MS = parseInt(
        process.env.MODBUS_TIMEOUT_MS || "5000",
        10,
      );

      try {
        console.log(
          `[Control] Connecting to ${relay.ipAddress}:${relay.port || 502}...`,
        );
        await client.connectTCP(relay.ipAddress, { port: relay.port || 502 });
        client.setID(relay.unitId || 1);
        client.setTimeout(MODBUS_TIMEOUT_MS);

        // 1. Get Command Address from Model Config
        const controlConfig = modelConfig.control || {};
        const coilAddress = controlConfig[command];

        if (coilAddress === undefined) {
          return res.status(400).json({
            success: false,
            message: `Command "${command}" not supported by this device model.`,
            messageKey: "ctrl_unsupported",
          });
        }

        console.log(
          `[Control] Sending ON to coil ${coilAddress} (Command: ${command})...`,
        );

        // Use writeCoil (Function 05)
        await client.writeCoil(coilAddress, true);
        console.log(
          `[Control] Command ${command} sent to coil ${coilAddress}.`,
        );

        // --- VERIFICATION LOGIC ---
        const expectedState = command === "couple"; // true if couple, false if decouple
        let verified = false;
        let actualState = !expectedState; // Assume failure initially

        // 1. First Check after 3 seconds
        console.log("[Control] Waiting 3s for verification...");
        await new Promise((resolve) => setTimeout(resolve, 3000));

        try {
          let inputRegisterAddress = 191;
          if (modelConfig.breakerStatus && modelConfig.breakerStatus.input) {
            inputRegisterAddress = modelConfig.breakerStatus.input;
          }

          const data = await client.readInputRegisters(inputRegisterAddress, 1);
          actualState = data.data[0] === 1;
          if (modelConfig.breakerStatus && modelConfig.breakerStatus.invert) {
            actualState = !actualState;
          }

          if (actualState === expectedState) {
            verified = true;
            console.log("[Control] Verification successful (Attempt 1).");
          } else {
            console.log(
              `[Control] Verification failed (Attempt 1). Expected ${expectedState}, got ${actualState}. Retrying in 5s...`,
            );

            // 2. Retry after 5 seconds
            await new Promise((resolve) => setTimeout(resolve, 5000));

            const dataRetry = await client.readInputRegisters(
              inputRegisterAddress,
              1,
            );
            actualState = dataRetry.data[0] === 1;
            if (modelConfig.breakerStatus && modelConfig.breakerStatus.invert) {
              actualState = !actualState;
            }

            if (actualState === expectedState) {
              verified = true;
              console.log("[Control] Verification successful (Attempt 2).");
            } else {
              console.log(
                `[Control] Verification failed (Attempt 2). Expected ${expectedState}, got ${actualState}.`,
              );
            }
          }
        } catch (readError) {
          console.error(
            "[Control] Error reading status for verification:",
            readError,
          );
        }

        // Update DB
        await knex("relays").where({ id: relayId }).update({
          breakerStatus: actualState,
          lastUpdated: knex.fn.now(),
        });

        if (verified) {
          res.json({
            success: true,
            message: `Successfully sent ${command} command and verified status.`,
            messageKey: "ctrl_success_verified",
            breakerClosed: actualState,
          });

          await logAudit({
            userId: req.user.id,
            username: req.user.username,
            action: "RELAY_CONTROL",
            targetType: "RELAY",
            targetId: relayId,
            details: JSON.stringify({ command, success: true, verified: true }),
            ipAddress: req.ip,
          });
        } else {
          res.json({
            success: false,
            verificationFailed: true,
            message: `Command sent, but breaker status did not change to ${command === "couple" ? "Closed" : "Open"} after 8 seconds.`,
            messageKey: "ctrl_sent_failed_verify",
            breakerClosed: actualState,
          });
        }
      } catch (modbusError) {
        console.error("[Control] Modbus error:", modbusError);
        res.status(500).json({
          success: false,
          message: `Modbus error: ${modbusError.message}`,
        });
      } finally {
        try {
          client.close();
        } catch (e) {}
      }
    } catch (error) {
      console.error("Control error:", error);
      res.status(500).json({
        success: false,
        message: "Server error during control operation.",
      });
    }
  },
);

// Control all relays of a plant
router.post(
  "/:plantId/relays/control-all",
  authMiddleware(["member", "admin", "superadmin"]),
  async (req, res) => {
    const { plantId } = req.params;
    const { command } = req.body;

    if (!["couple", "decouple"].includes(command)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid command." });
    }

    if (!getCommandRuntimeConfig().commandLiveEnabled) {
      try {
        const relays = await knex("relays").where({ plantId });
        if (!relays || relays.length === 0) {
          return res.status(404).json({
            success: false,
            message: "No relays found for this plant.",
          });
        }

        const dryRun = await executeCommand({
          commandKey: `legacy.relay.${command}`,
          target: { plantId, relayId: "all" },
          params: {
            legacyRoute: true,
            relayIds: relays.map((relay) => relay.id),
          },
          mode: "dry_run",
          user: req.user,
          ipAddress: req.ip,
        });

        return res.json({
          success: true,
          dryRun: true,
          message: dryRun.message,
          results: relays.map((relay) => ({
            relayId: relay.id,
            success: true,
            dryRun: true,
            runId: dryRun.runId,
          })),
          summary: {
            total: relays.length,
            succeeded: relays.length,
            failed: 0,
          },
          runId: dryRun.runId,
          status: dryRun.status,
          plannedEvents: dryRun.plannedEvents,
        });
      } catch (error) {
        return sendLegacyCommandError(res, error);
      }
    }

    try {
      const relays = await knex("relays").where({ plantId });

      if (!relays || relays.length === 0) {
        return res
          .status(404)
          .json({ success: false, message: "No relays found for this plant." });
      }

      // Fetch models manually
      for (const relay of relays) {
        if (relay.modelId) {
          const model = await knex("device_models")
            .where({ id: relay.modelId })
            .first();
          if (model) {
            relay.modelConfig = model.config;
          }
        }
      }

      const results = [];
      let successCount = 0;
      let failureCount = 0;

      for (const relay of relays) {
        const ModbusRTU = require("modbus-serial");
        const client = new ModbusRTU();
        const MODBUS_TIMEOUT_MS = parseInt(
          process.env.MODBUS_TIMEOUT_MS || "5000",
          10,
        );

        try {
          console.log(
            `[Control All] Connecting to ${relay.ipAddress}:${relay.port || 502}...`,
          );
          await client.connectTCP(relay.ipAddress, { port: relay.port || 502 });
          client.setID(relay.unitId || 1);
          client.setTimeout(MODBUS_TIMEOUT_MS);

          let modelConfig = relay.modelConfig;
          if (!modelConfig)
            throw new Error("Device model configuration missing.");
          if (typeof modelConfig === "string") {
            try {
              modelConfig = JSON.parse(modelConfig);
            } catch (e) {
              throw new Error(
                `Invalid device model configuration for relay ${relay.id}.`,
              );
            }
          }

          const controlConfig = modelConfig.control || {};
          const coilAddress = controlConfig[command];

          if (coilAddress === undefined) {
            failureCount++;
            results.push({
              relayId: relay.id,
              success: false,
              message: `Command "${command}" not supported.`,
              messageKey: "ctrl_unsupported",
            });
            client.close();
            continue;
          }

          await client.writeCoil(coilAddress, true);

          // Verification Logic (Simplified for Control All to avoid 8s delay per relay if possible, but parallelism is complex here)
          // We'll keep it sequential for safety
          const expectedState = command === "couple";
          let verified = false;
          let actualState = !expectedState;

          await new Promise((resolve) => setTimeout(resolve, 3000));

          try {
            let inputRegisterAddress = 191;
            if (modelConfig.breakerStatus && modelConfig.breakerStatus.input) {
              inputRegisterAddress = modelConfig.breakerStatus.input;
            }

            const data = await client.readInputRegisters(
              inputRegisterAddress,
              1,
            );
            actualState = data.data[0] === 1;
            if (modelConfig.breakerStatus && modelConfig.breakerStatus.invert) {
              actualState = !actualState;
            }

            if (actualState === expectedState) verified = true;
            else {
              await new Promise((resolve) => setTimeout(resolve, 5000));
              const dataRetry = await client.readInputRegisters(
                inputRegisterAddress,
                1,
              );
              actualState = dataRetry.data[0] === 1;
              if (modelConfig.breakerStatus && modelConfig.breakerStatus.invert)
                actualState = !actualState;
              if (actualState === expectedState) verified = true;
            }
          } catch (readError) {
            console.error(
              `[Control All] Error verifying relay ${relay.id}:`,
              readError,
            );
          }

          await knex("relays").where({ id: relay.id }).update({
            breakerStatus: actualState,
            lastUpdated: knex.fn.now(),
          });

          if (verified) {
            successCount++;
            results.push({
              relayId: relay.id,
              success: true,
              message: "Verified.",
            });
          } else {
            failureCount++;
            results.push({
              relayId: relay.id,
              success: false,
              verificationFailed: true,
            });
          }

          client.close();
        } catch (modbusError) {
          failureCount++;
          results.push({
            relayId: relay.id,
            success: false,
            message: modbusError.message,
          });
          try {
            client.close();
          } catch (e) {}
        }
      }

      const overallSuccess = failureCount === 0;
      const message = overallSuccess
        ? `Successfully ${command}d all ${successCount} relays.`
        : `${command} completed: ${successCount} succeeded, ${failureCount} failed.`;

      res.json({
        success: overallSuccess,
        message,
        results,
        summary: {
          total: relays.length,
          succeeded: successCount,
          failed: failureCount,
        },
      });
    } catch (error) {
      console.error("Control all error:", error);
      res.status(500).json({ success: false, message: "Server error." });
    }
  },
);

// DEBUG ENDPOINT
router.get(
  "/:plantId/relays/:relayId/debug",
  authMiddleware(["member", "admin", "superadmin"]),
  async (req, res) => {
    const { plantId, relayId } = req.params;
    const ModbusRTU = require("modbus-serial");
    const client = new ModbusRTU();

    try {
      const relay = await knex("relays")
        .join("device_models", "relays.modelId", "device_models.id")
        .select("relays.*", "device_models.config as modelConfig")
        .where({ "relays.id": relayId, "relays.plantId": plantId })
        .first();

      if (!relay)
        return res
          .status(404)
          .json({ success: false, message: "Relay not found." });

      console.log(`[Debug] Connecting to ${relay.ipAddress}...`);
      await client.connectTCP(relay.ipAddress, { port: relay.port || 502 });
      client.setID(relay.unitId || 1);
      client.setTimeout(parseInt(process.env.MODBUS_TIMEOUT_MS || "5000", 10));

      const results = {};
      try {
        const data = await client.readDiscreteInputs(370, 40);
        results.discreteInputs_370_410 = data.data;
      } catch (e) {
        results.discreteInputsError = e.message;
      }

      res.json({ success: true, results });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    } finally {
      try {
        client.close();
      } catch (e) {}
    }
  },
);

module.exports = router;
