const express = require("express");
const router = express.Router();
const knex = require("../db/knex");
const authMiddleware = require("../middleware/auth");

// GET /api/audit-logs
router.get("/", authMiddleware(["admin", "superadmin"]), async (req, res) => {
  try {
    const { limit = 100, type, action } = req.query;

    let query = knex("audit_logs")
      .select("*")
      .orderBy("created_at", "desc")
      .limit(limit);

    if (type) {
      query = query.where("targetType", type);
    }

    if (action) {
      query = query.where("action", action);
    }

    const logs = await query;
    res.json(logs);
  } catch (error) {
    console.error("Error fetching audit logs:", error);
    res
      .status(500)
      .json({ success: false, message: "Failed to fetch audit logs." });
  }
});

module.exports = router;
