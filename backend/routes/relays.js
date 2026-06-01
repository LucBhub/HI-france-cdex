const express = require("express");
const router = express.Router();
const knex = require("../db/knex");
const authMiddleware = require("../middleware/auth");
const { logAudit } = require("../utils/audit-logger");
const { readFaultsFromRelay } = require("../fault-service");
const { sendEmail } = require("../services/email-service");

/**
 * Send email alert when a découplage (breaker trip) is detected.
 * Sends to: plant email (if set) + all admin/superadmin users.
 */
async function sendDecouplageAlert(relay, relayId) {
  const recipients = [];

  // 1. Plant email (if configured)
  if (relay.plant_email) {
    recipients.push({ email: relay.plant_email, lang: "fr" }); // Default to FR for plant email
  }

  // 2. All admins and superadmins
  const admins = await knex("users")
    .whereIn("role", ["admin", "superadmin"])
    .whereNotNull("email")
    .select("email", "language");

  admins.forEach((a) => {
    // Add if not already present (avoid duplicates)
    if (!recipients.find((r) => r.email === a.email)) {
      recipients.push({ email: a.email, lang: a.language || "en" });
    }
  });

  if (recipients.length === 0) {
    console.warn("[Alert] No recipients found for découplage alert email.");
    return;
  }

  const now = new Date();
  const timeStr = now.toLocaleString("fr-FR", { timeZone: "Europe/Paris" });

  for (const recipient of recipients) {
    try {
      await sendEmail({
        to: recipient.email,
        templateKey: "DECOUPLAGE_ALERT",
        lang: recipient.lang,
        data: {
          plantName: relay.plant_name,
          relayId,
          timeStr,
        },
      });
      console.log(`[Alert] Localized découplage email sent to ${recipient.email} (${recipient.lang})`);
    } catch (err) {
      console.error(`[Alert] Failed to send localized alert to ${recipient.email}:`, err.message);
    }
  }
}

// Helper middleware for admin-only routes
const checkAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ error: "Authentication required" });
  }
  if (req.user.role !== "admin" && req.user.role !== "superadmin") {
    return res.status(403).json({ error: "Admin access required" });
  }
  next();
};

// Update relay measurements
router.put(
  "/:id/measurements",
  authMiddleware(["superadmin", "service_account"]),
  async (req, res) => {
    try {
      const { id } = req.params;
      const {
        voltageL1,
        voltageL2,
        voltageL3,
        currentL1,
        currentL2,
        currentL3,
        activePower,
        reactivePower,
        apparentPower,
        frequency,
        breakerStatus,
      } = req.body;

      // --- Breaker state change detection (découplage / recouplage) ---
      if (typeof breakerStatus !== "undefined") {
        try {
          const relay = await knex("relays")
            .where("relays.id", id)
            .join("plants", "relays.plantId", "plants.id")
            .select(
              "relays.breakerStatus as oldBreakerStatus",
              "relays.id as relay_id",
              "plants.id as plant_id",
              "plants.name as plant_name",
              "plants.email as plant_email",
            )
            .first();

          if (relay) {
            const oldStatus = relay.oldBreakerStatus;
            const newStatus = !!breakerStatus;

            // Découplage: closed (true) → open (false)
            if (oldStatus === true && newStatus === false) {
              console.log(
                `[Alert] ⚡ DÉCOUPLAGE detected on relay ${id} (plant: ${relay.plant_name})`,
              );

              // Create high-priority fault in DB
              await knex("relay_faults").insert({
                relay_id: id,
                fault_index: 0,
                fault_counter: Math.floor(Date.now() / 1000),
                timestamp: new Date().toISOString(),
                date: new Date().toISOString().split("T")[0],
                time: new Date().toISOString().split("T")[1].split(".")[0],
                cause: "Découplage détecté",
                fault_description: `Découplage détecté sur le relay ${id} de la centrale ${relay.plant_name}`,
                fault_type: "Découplage",
                is_active: true,
                acknowledged: false,
              });

              // Send email notification (async, don't block response)
              sendDecouplageAlert(relay, id).catch((err) =>
                console.error("[Alert] Email sending failed:", err.message),
              );
            }

            // Recouplage: open (false) → closed (true)
            if (oldStatus === false && newStatus === true) {
              console.log(
                `[Alert] ✅ RECOUPLAGE detected on relay ${id} (plant: ${relay.plant_name})`,
              );

              // Auto-resolve active découplage faults
              await knex("relay_faults")
                .where({
                  relay_id: id,
                  fault_type: "Découplage",
                  is_active: true,
                })
                .update({ is_active: false });
            }
          }
        } catch (alertErr) {
          // Don't fail the measurement update if alert logic fails
          console.error(
            "[Alert] Error in breaker state change detection:",
            alertErr.message,
          );
        }
      }

      const updatedCount = await knex("relays").where({ id }).update({
        voltageL1,
        voltageL2,
        voltageL3,
        currentL1,
        currentL2,
        currentL3,
        activePower,
        reactivePower,
        apparentPower,
        frequency,
        breakerStatus,
        lastUpdated: knex.fn.now(),
      });

      if (updatedCount > 0) {
        res.json({ success: true });
      } else {
        res.status(404).json({ success: false, message: "Relay not found." });
      }
    } catch (error) {
      console.error(
        `Error updating relay ${req.params.id} measurements:`,
        error,
      );
      res.status(500).json({
        success: false,
        message: "Error updating relay measurements.",
      });
    }
  },
);

// Get faults
router.get(
  "/:id/faults",
  authMiddleware(["member", "admin", "superadmin"]),
  async (req, res) => {
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
  },
);

// Get active faults
router.get(
  "/:id/faults/active",
  authMiddleware(["member", "admin", "superadmin"]),
  async (req, res) => {
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
  },
);

// Acknowledge fault
router.put(
  "/:id/faults/:faultId/acknowledge",
  authMiddleware(["member", "admin", "superadmin"]),
  async (req, res) => {
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

      await logAudit({
        userId: userId,
        username: req.user.username,
        action: "FAULT_ACK",
        targetType: "RELAY",
        targetId: id,
        details: `Fault ID ${faultId} acknowledged`,
        ipAddress: req.ip,
      });
    } catch (error) {
      console.error("Error acknowledging fault:", error);
      res.status(500).json({ error: "Failed to acknowledge fault" });
    }
  },
);

// Trigger fault refresh
router.post(
  "/:id/faults/refresh",
  authMiddleware(["member", "admin", "superadmin"]),
  async (req, res) => {
    try {
      const { id } = req.params;
      const relayId = parseInt(id, 10);

      const relay = await knex("relays").where({ id: relayId }).first();
      if (!relay) {
        return res
          .status(404)
          .json({ success: false, message: "Relay not found." });
      }

      await readFaultsFromRelay(relay);

      res.json({ success: true, message: "Fault refresh triggered." });
    } catch (error) {
      console.error(
        `Error refreshing faults for relay ${req.params.id}:`,
        error,
      );
      res
        .status(500)
        .json({ success: false, message: "Error triggering fault refresh." });
    }
  },
);

// Delete fault (admin)
router.delete(
  "/:id/faults/:faultId",
  authMiddleware(["admin", "superadmin"]),
  checkAdmin,
  async (req, res) => {
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
  },
);

// Delete all faults (admin)
router.delete(
  "/:id/faults",
  authMiddleware(["admin", "superadmin"]),
  checkAdmin,
  async (req, res) => {
    try {
      const { id } = req.params;
      const deleted = await knex("relay_faults").where({ relay_id: id }).del();
      res.json({ success: true, deleted });
    } catch (error) {
      console.error("Error deleting all faults:", error);
      res.status(500).json({ error: "Failed to delete faults" });
    }
  },
);

module.exports = router;
