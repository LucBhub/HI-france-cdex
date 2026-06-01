const express = require("express");
const authMiddleware = require("../middleware/auth");
const {
  executeCommand,
  getRun,
  listCatalog,
  listRuns,
} = require("../services/command-service");

const router = express.Router();

const allowedRoles = ["member", "admin", "superadmin"];

function sendCommandError(res, error) {
  const status = error.status || 500;
  res.status(status).json({
    success: false,
    code: error.code || "command_error",
    message: error.message || "Command failed.",
    ...(error.runId ? { runId: error.runId } : {}),
    ...(error.plannedEvents ? { plannedEvents: error.plannedEvents } : {}),
  });
}

router.get("/catalog", authMiddleware(allowedRoles), async (req, res) => {
  try {
    const catalog = await listCatalog();
    res.json({ success: true, catalog });
  } catch (error) {
    sendCommandError(res, error);
  }
});

router.get("/runs", authMiddleware(allowedRoles), async (req, res) => {
  try {
    const runs = await listRuns({ limit: req.query.limit });
    res.json({ success: true, runs });
  } catch (error) {
    sendCommandError(res, error);
  }
});

router.get("/runs/:id", authMiddleware(allowedRoles), async (req, res) => {
  try {
    const run = await getRun(req.params.id);
    if (!run) {
      return res.status(404).json({
        success: false,
        code: "run_not_found",
        message: "Command run not found.",
      });
    }
    res.json({ success: true, run });
  } catch (error) {
    sendCommandError(res, error);
  }
});

router.post("/", authMiddleware(allowedRoles), async (req, res) => {
  try {
    const { commandKey, target = {}, params = {}, mode = "dry_run" } = req.body;
    if (!commandKey) {
      return res.status(400).json({
        success: false,
        code: "missing_command_key",
        message: "commandKey is required.",
      });
    }

    const result = await executeCommand({
      commandKey,
      target,
      params,
      mode,
      user: req.user,
      ipAddress: req.ip,
    });

    res.json(result);
  } catch (error) {
    sendCommandError(res, error);
  }
});

module.exports = router;
