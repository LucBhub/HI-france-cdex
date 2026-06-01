const fs = require("fs");
const path = require("path");

// Load .env from current dir or parent dir (fallback for local dev)
const envPath = fs.existsSync(path.join(__dirname, ".env"))
  ? path.join(__dirname, ".env")
  : path.join(__dirname, "../.env");

require("dotenv").config({ path: envPath });

const express = require("express");
const cors = require("cors");
const initDb = require("./lib/db-init");

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
const defaultOrigins =
  process.env.NODE_ENV === "production"
    ? ["https://hi2.host.reden.cloud"]
    : [
        "http://localhost:3000",
        "https://localhost:3000",
        "https://localhost:3001",
      ];
const allowedOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(",")
      .map((o) => o.trim())
      .concat(defaultOrigins)
  : defaultOrigins;
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (server-to-server, curl, etc.)
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else if (process.env.NODE_ENV !== "production") {
        callback(null, true); // In dev, allow all origins
      } else {
        callback(new Error(`CORS: Origin ${origin} not allowed`));
      }
    },
    credentials: true,
  }),
);
app.use(express.json());
const cookieParser = require("cookie-parser");
app.use(cookieParser());

// Health Check Endpoint (for K8s probes)
app.get("/health", async (req, res) => {
  try {
    const knex = require("./db/knex");
    await knex.raw("SELECT 1");
    res.json({ status: "ok", db: "connected" });
  } catch (error) {
    res
      .status(503)
      .json({ status: "degraded", db: "disconnected", error: error.message });
  }
});

// Routes
app.use("/api/auth", require("./routes/auth"));
app.use("/api/auth/azure", require("./routes/auth-azure"));
app.use("/api/users", require("./routes/users"));
app.use("/api/plants", require("./routes/plants"));
app.use("/api/device-models", require("./routes/device-models"));
app.use("/api/reports", require("./routes/reports"));
app.use("/api/alarms", require("./routes/alarms"));
app.use("/api/relays", require("./routes/relays"));
app.use("/api/audit-logs", require("./routes/audit-logs"));
app.use("/api/irradiation", require("./routes/irradiation"));
app.use("/api/commands", require("./routes/commands"));
app.use("/api/architecture", require("./routes/architecture"));
app.use("/api/debug", require("./routes/debug"));

// Swagger UI (dev + preprod uniquement — désactivé en production)
const { setupSwagger } = require("./lib/swagger");
setupSwagger(app);

// Global Error Handler
app.use((err, req, res, next) => {
  console.error("[Global Error]", err.stack || err);
  if (res.headersSent) {
    return next(err);
  }

  // Specific Database Errors (Postgres)
  if (err.code === "42P01") {
    // undefined_table
    return res.status(503).json({
      success: false,
      message:
        "Database initialization incomplete (Table missing). Please run migrations.",
      error_code: "DB_MISSING_TABLE",
      debug: err.message,
    });
  }
  if (err.code === "42703") {
    // undefined_column
    return res.status(500).json({
      success: false,
      message: "Database schema mismatch (Column missing). Migration required.",
      error_code: "DB_MISSING_COLUMN",
      debug: err.message,
    });
  }
  if (err.code === "28P01") {
    // invalid_password
    return res.status(500).json({
      success: false,
      message: "Database authentication failed.",
      error_code: "DB_AUTH_FAILED",
    });
  }

  const isProduction = process.env.NODE_ENV === "production";
  res.status(500).json({
    success: false,
    message: "Internal Server Error",
    ...(isProduction
      ? {}
      : { debug: err.message || String(err), stack: err.stack }),
  });
});

const https = require("https");
const http = require("http");

// Start Server
const startServer = async () => {
  // Audit Configuration
  console.log("[Server] Starting up...");
  const criticalVars = [
    "JWT_SECRET",
    "DB_HOST",
    "DB_USER",
    "DB_PASS",
    "DB_NAME",
    "AZURE_TENANT_ID",
    "AZURE_CLIENT_ID",
  ];
  const missingVars = criticalVars.filter((v) => !process.env[v]);

  if (missingVars.length > 0) {
    console.error(
      "CRITICAL: Missing environment variables:",
      missingVars.join(", "),
    );
  } else {
    console.log("[Server] All critical environment variables are present.");
  }

  await initDb();

  // Start fault monitoring service (reads Modbus fault records every 60s)
  const { startFaultService } = require("./fault-service");
  startFaultService();

  // Start irradiation data sync scheduler (Open-Meteo)
  try {
    const { startIrradiationScheduler } = require("./cron/irradiation-fetcher");
    startIrradiationScheduler();
  } catch (irrError) {
    console.error(
      "[Server] Failed to start irradiation scheduler:",
      irrError.message,
    );
  }

  // Start measurements aggregator scheduler (hourly aggregation for reports)
  try {
    const { startAggregatorScheduler } = require("./cron/aggregator");
    startAggregatorScheduler();
  } catch (aggError) {
    console.error(
      "[Server] Failed to start aggregator scheduler:",
      aggError.message,
    );
  }

  let server;
  try {
    const key = fs.readFileSync("/certs/server.key");
    const cert = fs.readFileSync("/certs/server.crt");
    server = https.createServer({ key, cert }, app);
    console.log("[Server] HTTPS Enabled using /certs/");
  } catch (e) {
    try {
      // Fallback for local dev if certs are relative
      const path = require("path");
      const key = fs.readFileSync(path.join(__dirname, "../certs/server.key"));
      const cert = fs.readFileSync(path.join(__dirname, "../certs/server.crt"));
      server = https.createServer({ key, cert }, app);
      console.log("[Server] HTTPS Enabled using local ../certs/");
    } catch (e2) {
      console.log("[Server] Certificates not found. Falling back to HTTP.");
      server = http.createServer(app);
    }
  }

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`[Server] Running on port ${PORT} (${process.env.NODE_ENV})`);
  });

  // Internal HTTP server for container-to-container communication (no SSL issues)
  const INTERNAL_PORT = process.env.INTERNAL_PORT || 3002;
  const internalServer = http.createServer(app);
  internalServer.listen(INTERNAL_PORT, "0.0.0.0", () => {
    console.log(`[Server] Internal HTTP listener on port ${INTERNAL_PORT}`);
  });
};

startServer();
