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

function isPlainObject(value) {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value)
  );
}

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

function validateCommandPayload(body) {
  const payload = isPlainObject(body) ? body : {};
  const commandKey =
    typeof payload.commandKey === "string" ? payload.commandKey.trim() : "";

  if (!commandKey) {
    return {
      status: 400,
      error: {
        success: false,
        code: "missing_command_key",
        message: "commandKey is required.",
      },
    };
  }

  if (payload.mode !== undefined && payload.mode !== "dry_run") {
    return {
      status: 403,
      error: {
        success: false,
        code: "live_disabled",
        message: "Live commands are disabled. Only dry_run is allowed.",
      },
    };
  }

  const target = payload.target === undefined ? {} : payload.target;
  if (!isPlainObject(target)) {
    return {
      status: 400,
      error: {
        success: false,
        code: "invalid_target",
        message: "target must be an object.",
      },
    };
  }

  const params = payload.params === undefined ? {} : payload.params;
  if (!isPlainObject(params)) {
    return {
      status: 400,
      error: {
        success: false,
        code: "invalid_params",
        message: "params must be an object.",
      },
    };
  }

  return {
    value: {
      commandKey,
      target,
      params,
      mode: "dry_run",
    },
  };
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

router.get("/runs/:id/status", authMiddleware(allowedRoles), async (req, res) => {
  try {
    const run = await getRun(req.params.id);
    if (!run) {
      return res.status(404).json({
        success: false,
        code: "run_not_found",
        message: "Command run not found.",
      });
    }

    res.json({
      success: true,
      runId: run.id,
      commandKey: run.command_key,
      status: run.status,
      dryRun: run.dry_run,
      eventSummary: run.eventSummary,
      timeline: run.timeline,
    });
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
    const validation = validateCommandPayload(req.body);
    if (validation.error) {
      return res.status(validation.status).json(validation.error);
    }

    const { commandKey, target, params, mode } = validation.value;
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
