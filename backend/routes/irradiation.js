const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/auth");
const { runDataSync } = require("../cron/irradiation-fetcher");

// POST /api/irradiation/sync
router.post(
  "/sync",
  authMiddleware(["admin", "superadmin"]),
  async (req, res) => {
    try {
      console.log("[API] Manual irradiation sync triggered.");
      // Trigger sync but don't hold the request too long if it takes time?
      // For now, we await it to report errors properly.
      await runDataSync();

      res.json({
        success: true,
        message: "Irradiation data synced successfully.",
      });
    } catch (error) {
      console.error("Error during manual irradiation sync:", error);
      res
        .status(500)
        .json({ success: false, message: "Failed to sync irradiation data." });
    }
  },
);

module.exports = router;
