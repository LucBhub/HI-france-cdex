const express = require("express");
const router = express.Router();
const knex = require("../db/knex");
const authMiddleware = require("../middleware/auth");

// Debug endpoint - restricted to superadmin only
router.get("/db-status", authMiddleware(["superadmin"]), async (req, res) => {
  try {
    // Test basic connection
    const connectionCheck = await knex.raw("SELECT 1+1 as result");

    // List all tables in public schema
    const tablesQuery = await knex.raw(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'",
    );
    const tableNames = tablesQuery.rows.map((t) => t.table_name);

    const counts = {};
    for (const table of tableNames) {
      try {
        const countResult = await knex(table).count("* as c").first();
        counts[table] = countResult.c;
      } catch (e) {
        counts[table] = "Error: " + e.message;
      }
    }

    res.json({
      success: true,
      message: "Database connection successful",
      database: {
        host: process.env.DB_HOST,
        database: process.env.DB_NAME,
        user: process.env.DB_USER ? "***" : "missing",
        table_count: tableNames.length,
      },
      tables: counts,
      env_vars: {
        JWT_SECRET: process.env.JWT_SECRET ? "Present" : "Missing",
        AZURE_TENANT: process.env.AZURE_TENANT_ID ? "Present" : "Missing",
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Database Check Failed",
      error: error.message,
      stack: error.stack,
      env_vars: {
        DB_HOST: process.env.DB_HOST,
        DB_USER: process.env.DB_USER,
      },
    });
  }
});

module.exports = router;
