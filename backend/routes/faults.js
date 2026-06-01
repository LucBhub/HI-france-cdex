/**
 * Fault Management Routes
 *
 * Endpoints for managing relay faults/incidents
 */

const express = require("express");
const router = express.Router();
const knex = require("../db/knex");
const checkAdmin = require("../middleware/checkAdmin");
const { readFaultsFromRelay } = require("../fault-service");

/**
 * GET /api/relays/:id/faults
 * Get all faults for a relay
 */
router.get("/:id/faults", async (req, res) => {
  try {
    const { id } = req.params;

    const faults = await knex("relay_faults")
      .where({ relay_id: id })
      .leftJoin("users", "relay_faults.acknowledged_by", "users.id")
      .select("relay_faults.*", "users.username as acknowledged_by_username")
      .orderBy("relay_faults.created_at", "desc");

    res.json(faults);
  } catch (error) {
    console.error("Error fetching faults:", error);
    res.status(500).json({ error: "Failed to fetch faults" });
  }
});

/**
 * GET /api/relays/:id/faults/active
 * Get only active (non-acknowledged) faults for a relay
 */
router.get("/:id/faults/active", async (req, res) => {
  try {
    const { id } = req.params;

    const faults = await knex("relay_faults")
      .where({
        relay_id: id,
        is_active: true,
        acknowledged: false,
      })
      .orderBy("created_at", "desc");

    res.json(faults);
  } catch (error) {
    console.error("Error fetching active faults:", error);
    res.status(500).json({ error: "Failed to fetch active faults" });
  }
});

/**
 * POST /api/relays/:id/faults/refresh
 * Force a fault reading from the relay
 */
router.post("/:id/faults/refresh", async (req, res) => {
  try {
    const { id } = req.params;

    // Get relay info
    const relay = await knex("devices").where({ id }).first();

    if (!relay) {
      return res.status(404).json({ error: "Relay not found" });
    }

    // Read faults from relay
    await readFaultsFromRelay(relay);

    // Return updated faults
    const faults = await knex("relay_faults")
      .where({ relay_id: id })
      .orderBy("created_at", "desc")
      .limit(10);

    res.json(faults);
  } catch (error) {
    console.error("Error refreshing faults:", error);
    res.status(500).json({ error: "Failed to refresh faults" });
  }
});

/**
 * PUT /api/relays/:id/faults/:faultId/acknowledge
 * Acknowledge a fault
 */
router.put("/:id/faults/:faultId/acknowledge", async (req, res) => {
  try {
    const { id, faultId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const updated = await knex("relay_faults")
      .where({
        id: faultId,
        relay_id: id,
      })
      .update({
        acknowledged: true,
        acknowledged_by: userId,
        acknowledged_at: new Date().toISOString(),
      });

    if (updated === 0) {
      return res.status(404).json({ error: "Fault not found" });
    }

    res.json({ success: true });
  } catch (error) {
    console.error("Error acknowledging fault:", error);
    res.status(500).json({ error: "Failed to acknowledge fault" });
  }
});

/**
 * DELETE /api/relays/:id/faults/:faultId
 * Delete a specific fault (admin only)
 */
router.delete("/:id/faults/:faultId", checkAdmin, async (req, res) => {
  try {
    const { id, faultId } = req.params;

    const deleted = await knex("relay_faults")
      .where({
        id: faultId,
        relay_id: id,
      })
      .del();

    if (deleted === 0) {
      return res.status(404).json({ error: "Fault not found" });
    }

    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting fault:", error);
    res.status(500).json({ error: "Failed to delete fault" });
  }
});

/**
 * DELETE /api/relays/:id/faults
 * Delete all faults for a relay (admin only)
 */
router.delete("/:id/faults", checkAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const deleted = await knex("relay_faults").where({ relay_id: id }).del();

    res.json({ success: true, deleted });
  } catch (error) {
    console.error("Error deleting all faults:", error);
    res.status(500).json({ error: "Failed to delete faults" });
  }
});

module.exports = router;
