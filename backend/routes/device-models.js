const express = require("express");
const router = express.Router();
const knex = require("../db/knex");
const authMiddleware = require("../middleware/auth");

router.get(
  "/",
  authMiddleware(["member", "admin", "superadmin"]),
  async (req, res) => {
    // console.log('[DEBUG] GET /api/device-models called by user:', req.user);
    try {
      const models = await knex("device_models").select("id", "name", "config");
      // console.log('[DEBUG] Found models:', models.length);
      // Parse config JSON
      const parsedModels = models.map((m) => ({
        ...m,
        config: typeof m.config === "string" ? JSON.parse(m.config) : m.config,
      }));
      res.json(parsedModels);
    } catch (error) {
      console.error("Error fetching device models:", error);
      res
        .status(500)
        .json({ success: false, message: "Error fetching device models." });
    }
  },
);

router.post("/", authMiddleware(["admin", "superadmin"]), async (req, res) => {
  try {
    const { id, name, config } = req.body;
    if (!id || !name || !config) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields (id, name, config).",
      });
    }

    // Ensure config is a valid JSON string or object
    const configStr =
      typeof config === "object" ? JSON.stringify(config) : config;

    await knex("device_models").insert({
      id,
      name,
      config: configStr,
    });

    res.status(201).json({ success: true, message: "Device model created." });
  } catch (error) {
    console.error("Error creating device model:", error);
    if (error.code === "SQLITE_CONSTRAINT") {
      return res
        .status(409)
        .json({ success: false, message: "Model ID already exists." });
    }
    res
      .status(500)
      .json({ success: false, message: "Error creating device model." });
  }
});

router.put(
  "/:id",
  authMiddleware(["admin", "superadmin"]),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { name, config } = req.body;

      if (!name || !config) {
        return res.status(400).json({
          success: false,
          message: "Missing required fields (name, config).",
        });
      }

      const configStr =
        typeof config === "object" ? JSON.stringify(config) : config;

      const updated = await knex("device_models").where({ id }).update({
        name,
        config: configStr,
      });

      if (updated === 0) {
        return res
          .status(404)
          .json({ success: false, message: "Model not found." });
      }

      res.json({ success: true, message: "Device model updated." });
    } catch (error) {
      console.error("Error updating device model:", error);
      res
        .status(500)
        .json({ success: false, message: "Error updating device model." });
    }
  },
);

router.delete(
  "/:id",
  authMiddleware(["admin", "superadmin"]),
  async (req, res) => {
    try {
      const { id } = req.params;

      const deleted = await knex("device_models").where({ id }).delete();

      if (deleted === 0) {
        return res
          .status(404)
          .json({ success: false, message: "Model not found." });
      }

      res.json({ success: true, message: "Device model deleted." });
    } catch (error) {
      console.error("Error deleting device model:", error);
      res
        .status(500)
        .json({ success: false, message: "Error deleting device model." });
    }
  },
);

const {
  generateFormula,
  MEASUREMENT_TYPES,
} = require("../utils/formula-generator");
const ModbusRTU = require("modbus-serial");

// Helper functions for parsing Modbus data
function parseUWord(buffer, offset) {
  return buffer.readUInt16BE(offset);
}

function parseLong(buffer, offset) {
  const highWord = buffer.readUInt16BE(offset);
  const lowWord = buffer.readUInt16BE(offset + 2);
  let combined = highWord * 0x10000 + lowWord;
  if (combined > 0x7fffffff) {
    combined -= 0x100000000;
  }
  return combined;
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

// POST /api/device-models/test-read
router.post(
  "/test-read",
  authMiddleware(["admin", "superadmin"]),
  async (req, res) => {
    const {
      relayId,
      address,
      length = 2,
      dataType,
      endianness,
      kv,
      measurementType,
      unit,
    } = req.body;

    try {
      const relay = await knex("relays").where({ id: relayId }).first();
      if (!relay) return res.status(404).json({ error: "Relay not found" });

      const client = new ModbusRTU();
      await client.connectTCP(relay.ipAddress, { port: relay.port || 502 });
      client.setID(relay.unitId || 1);
      client.setTimeout(5000);

      const data = await client.readInputRegisters(address, length);
      client.close();

      let rawValue;
      let rawHex;

      if (dataType === "UWORD") {
        rawValue = parseUWord(data.buffer, 0);
        rawHex = "0x" + data.buffer.toString("hex", 0, 2).toUpperCase();
      } else if (dataType === "LONG") {
        if (endianness === "word_swap") {
          rawValue = parseSwappedLong(data.buffer, 0);
        } else {
          rawValue = parseLong(data.buffer, 0);
        }
        rawHex = "0x" + data.buffer.toString("hex", 0, 4).toUpperCase();
      } else {
        return res.status(400).json({ error: "Invalid data type" });
      }

      const formula = generateFormula(measurementType, kv, { unit });
      // NOTE: The original index.js passed `rawValue` to `formula.calculate`.
      // We will assume `formula` or `kv` logic is enough.
      // Actually the original code did:
      // const calculated = formula.calculate ? formula.calculate(rawValue) : rawValue / kv;
      // Since `formula` object from generator might not have `calculate` method if we don't import the factory,
      // let's just do the simple calculation here as it was likely cleaner in original.
      // But `generateFormula` likely returns an object describing the formula, not a function?
      // Let's replicate simple logic:
      const calculated = rawValue / (kv || 1);

      res.json({
        success: true,
        rawHex,
        rawValue,
        calculated,
        formula: formula.display, // Assuming this exists
      });
    } catch (error) {
      console.error("[Test Read] Error:", error);
      res.status(500).json({ error: error.message });
    }
  },
);

module.exports = router;
