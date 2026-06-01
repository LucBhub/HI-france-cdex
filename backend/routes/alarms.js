const express = require("express");
const router = express.Router();
const knex = require("../db/knex");
const authMiddleware = require("../middleware/auth");

// router.get('/', authMiddleware(['member', 'admin', 'superadmin']), async (req, res) => {
// router.get('/', async (req, res) => { // TEMP DEBUG: Auth disabled
router.get(
  "/",
  authMiddleware(["member", "admin", "superadmin"]),
  async (req, res) => {
    try {
      const alarms = [];

      // 1. Get ALL active faults (acknowledged or not)
      const faults = await knex("relay_faults")
        .where({ is_active: true })
        .join("relays", "relay_faults.relay_id", "relays.id")
        .join("plants", "relays.plantId", "plants.id")
        .select(
          "relay_faults.id as fault_id",
          "relay_faults.fault_type",
          "relay_faults.fault_counter",
          "relay_faults.created_at",
          "relay_faults.acknowledged",
          "relays.id as relay_id",
          "plants.id as plant_id",
          "plants.name as plant_name",
        );

      // Format faults as alarms
      faults.forEach((fault) => {
        // High priority for critical faults
        const priority = ["L1-L2-L3", "L1-L2-L3-E", "Découplage"].includes(
          fault.fault_type,
        )
          ? "high"
          : "medium";

        alarms.push({
          id: `fault-${fault.fault_id}`,
          type: "fault",
          plantId: fault.plant_id,
          plantName: fault.plant_name,
          relayId: fault.relay_id,
          relayName: `Relay ${fault.relay_id}`,
          priority,
          status: "active",
          message: fault.fault_type,
          faultType: fault.fault_type,
          messageKey: "incident_detected",
          timestamp: fault.created_at,
          faultCounter: fault.fault_counter,
          acknowledged: !!fault.acknowledged,
        });
      });

      // 2. Get relays with open breakers
      const relays = await knex("relays")
        .join("plants", "relays.plantId", "plants.id")
        .select(
          "relays.id",
          "relays.breakerStatus",
          "plants.id as plant_id",
          "plants.name as plant_name",
        );

      relays.forEach((relay) => {
        // Breaker status: 0 = open (disconnected), 1 = closed (connected)
        if (relay.breakerStatus === 0) {
          alarms.push({
            id: `breaker-${relay.id}`,
            type: "breaker",
            plantId: relay.plant_id,
            plantName: relay.plant_name,
            relayId: relay.id,
            relayName: `Relay ${relay.id}`,
            priority: "medium",
            status: "active",
            message: "breaker_open_msg",
            messageKey: "breaker_open_msg",
            timestamp: new Date().toISOString(),
          });
        }
      });

      // Sort by priority (high > medium > low) then by timestamp (newest first)
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      alarms.sort((a, b) => {
        const priorityDiff =
          priorityOrder[a.priority] - priorityOrder[b.priority];
        if (priorityDiff !== 0) return priorityDiff;
        return new Date(b.timestamp) - new Date(a.timestamp);
      });

      res.json(alarms);
    } catch (error) {
      console.error("[Alarms] Error fetching alarms:", error);
      res.status(500).json({
        error: "Failed to fetch alarms",
        debug: error.message,
        stack: process.env.NODE_ENV !== "production" ? error.stack : undefined,
      });
    }
  },
);

module.exports = router;
