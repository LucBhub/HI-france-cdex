const knex = require("../db/knex");
const { getCommandRuntimeConfig } = require("../config/runtime");
const { logAudit } = require("../utils/audit-logger");

function parseMaybeJson(value, fallback) {
  if (value === null || value === undefined) return fallback;
  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch (error) {
      return fallback;
    }
  }
  return value;
}

function commandError(status, code, message, extra = {}) {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  Object.assign(error, extra);
  return error;
}

function interpolate(template, values) {
  return String(template).replace(/\{([A-Za-z0-9_]+)\}/g, (_match, key) => {
    const value = values[key];
    return value === undefined || value === null ? `{${key}}` : String(value);
  });
}

function payloadFromTemplate(template, params) {
  if (Array.isArray(template.payloadSequence)) {
    return template.payloadSequence.map((value) => String(value));
  }

  if (template.payloadParam) {
    const value =
      params[template.payloadParam] !== undefined
        ? params[template.payloadParam]
        : template.defaultPayload;
    return [String(value)];
  }

  if (template.defaultPayload !== undefined) {
    return [String(template.defaultPayload)];
  }

  return ["true"];
}

function validateRequired(required, source, sourceName) {
  for (const key of required || []) {
    if (
      source[key] === undefined ||
      source[key] === null ||
      String(source[key]).trim() === ""
    ) {
      throw commandError(
        400,
        "missing_field",
        `Missing required ${sourceName} field: ${key}`,
        { field: key },
      );
    }
  }
}

function buildPlannedEvents(catalogRow, target = {}, params = {}) {
  const template = parseMaybeJson(catalogRow.template, {});
  validateRequired(template.requiredTarget, target, "target");
  validateRequired(template.requiredParams, params, "params");

  const values = {
    client: "MQTT",
    ...target,
    ...params,
  };
  const payloads = payloadFromTemplate(template, params);
  const plannedPulseMs = Number(template.plannedPulseMs || 0);
  const events = [];
  let sequence = 1;

  for (const topicTemplate of template.topicTemplates || []) {
    for (const payload of payloads) {
      events.push({
        sequence: sequence++,
        transport: "mqtt",
        topic: interpolate(topicTemplate, values),
        payload,
        plannedPulseMs,
      });
    }
  }

  for (const tagTemplate of template.tagTemplates || []) {
    for (const payload of payloads) {
      events.push({
        sequence: sequence++,
        transport: "tag",
        tagPath: interpolate(tagTemplate, values),
        payload,
        plannedPulseMs,
      });
    }
  }

  return events;
}

async function publishMqttEvents(events, deps = {}) {
  const mqtt = deps.mqtt || require("mqtt");
  const runtime = deps.runtimeConfig || getCommandRuntimeConfig();
  const mqttUrl = deps.mqttUrl || runtime.mqttUrl;
  const connectTimeoutMs =
    deps.mqttConnectTimeoutMs || runtime.mqttConnectTimeoutMs;
  const mqttEvents = events.filter((event) => event.transport === "mqtt");

  if (mqttEvents.length === 0) {
    return { published: 0 };
  }

  const client = mqtt.connect(mqttUrl, {
    connectTimeout: connectTimeoutMs,
    reconnectPeriod: 0,
  });

  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error(`MQTT connection timed out: ${mqttUrl}`));
    }, connectTimeoutMs + 250);

    client.once("connect", () => {
      clearTimeout(timeout);
      resolve();
    });
    client.once("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
  });

  try {
    for (const event of mqttEvents) {
      await new Promise((resolve, reject) => {
        client.publish(event.topic, event.payload, { qos: 0 }, (error) => {
          if (error) reject(error);
          else resolve();
        });
      });
    }
  } finally {
    await new Promise((resolve) => {
      let done = false;
      const finish = () => {
        if (!done) {
          done = true;
          resolve();
        }
      };
      const timeout = setTimeout(finish, 1000);
      if (timeout.unref) timeout.unref();

      try {
        client.end(false, {}, () => {
          clearTimeout(timeout);
          finish();
        });
      } catch (_error) {
        clearTimeout(timeout);
        finish();
      }
    });
  }

  return { published: mqttEvents.length };
}

function dbJson(value) {
  return JSON.stringify(value === undefined ? null : value);
}

function eventTimestamp(event) {
  if (!event?.created_at) return null;
  const value = new Date(event.created_at).getTime();
  return Number.isFinite(value) ? value : null;
}

function summarizeRunEvents(events = []) {
  const summary = {
    totalEvents: events.length,
    plannedPublishes: 0,
    publishedPublishes: 0,
    plannedTagWrites: 0,
    simulatorReceipts: 0,
    simulatorAcks: 0,
    failedEvents: 0,
    hasSimulatorReceipt: false,
    hasSimulatorAck: false,
    lastEventAt: null,
    sandboxStatus: "planned",
  };

  for (const event of events) {
    if (event.event_type === "planned_publish") {
      summary.plannedPublishes += 1;
      if (event.status === "published") summary.publishedPublishes += 1;
    }
    if (event.event_type === "planned_tag_write") {
      summary.plannedTagWrites += 1;
    }
    if (event.event_type === "simulator_received") {
      summary.simulatorReceipts += 1;
      summary.hasSimulatorReceipt = true;
    }
    if (event.event_type === "simulator_ack") {
      summary.simulatorAcks += 1;
      if (event.status === "published") summary.hasSimulatorAck = true;
    }
    if (event.status === "failed") {
      summary.failedEvents += 1;
    }

    const timestamp = eventTimestamp(event);
    if (
      timestamp &&
      (!summary.lastEventAt ||
        timestamp > new Date(summary.lastEventAt).getTime())
    ) {
      summary.lastEventAt = new Date(timestamp).toISOString();
    }
  }

  if (summary.failedEvents > 0) {
    summary.sandboxStatus = "failed";
  } else if (summary.hasSimulatorAck) {
    summary.sandboxStatus = "acknowledged";
  } else if (summary.hasSimulatorReceipt) {
    summary.sandboxStatus = "received";
  } else if (
    summary.plannedPublishes > 0 &&
    summary.publishedPublishes === summary.plannedPublishes
  ) {
    summary.sandboxStatus = "published";
  } else if (summary.totalEvents > 0) {
    summary.sandboxStatus = "planned";
  }

  return summary;
}

function normalizeTimelineEvent(event) {
  const metadata = parseMaybeJson(event.metadata, {});
  return {
    id: event.id,
    at: event.created_at || null,
    commandRunId: event.command_run_id || null,
    direction: event.direction,
    type: event.event_type,
    status: event.status,
    topic: event.topic,
    payload: event.payload,
    sequence: metadata.sequence || null,
    transport: metadata.transport || null,
    plannedPulseMs: metadata.plannedPulseMs || 0,
    matchedOutboundEventId: metadata.matchedOutboundEventId || null,
  };
}

function decorateRun(run, events = []) {
  if (!run) return null;
  const sortedEvents = [...events].sort((a, b) => {
    const timeDiff = (eventTimestamp(a) || 0) - (eventTimestamp(b) || 0);
    if (timeDiff !== 0) return timeDiff;
    return (a.id || 0) - (b.id || 0);
  });

  return {
    ...run,
    target: parseMaybeJson(run.target, run.target),
    params: parseMaybeJson(run.params, run.params),
    planned_events: parseMaybeJson(run.planned_events, run.planned_events),
    events: sortedEvents,
    eventSummary: summarizeRunEvents(sortedEvents),
    timeline: sortedEvents.map(normalizeTimelineEvent),
  };
}

async function executeCommand(
  { commandKey, target = {}, params = {}, mode = "dry_run", user, ipAddress },
  deps = {},
) {
  const db = deps.knex || knex;
  const audit = deps.logAudit || logAudit;
  const runtime = deps.runtimeConfig || getCommandRuntimeConfig();
  const commandMode = mode || runtime.commandMode;

  if (commandMode !== "dry_run") {
    throw commandError(
      403,
      "live_disabled",
      "Live commands are disabled. Only dry_run is allowed.",
    );
  }

  const catalogRow = await db("command_catalog")
    .where({ command_key: commandKey })
    .first();

  if (!catalogRow) {
    throw commandError(404, "unknown_command", `Unknown command: ${commandKey}`);
  }

  const plannedEvents = buildPlannedEvents(catalogRow, target, params);

  const inserted = await db("command_runs")
    .insert({
      command_key: commandKey,
      mode: "dry_run",
      status: "planned",
      dry_run: true,
      user_id: user?.id || null,
      requested_by: user?.username || "unknown",
      target: dbJson(target),
      params: dbJson(params),
      planned_events: dbJson(plannedEvents),
    })
    .returning("id");
  const runId = Array.isArray(inserted)
    ? typeof inserted[0] === "object"
      ? inserted[0].id
      : inserted[0]
    : inserted;

  for (const event of plannedEvents) {
    await db("sandbox_mqtt_events").insert({
      command_run_id: runId,
      direction: "outbound",
      event_type: event.transport === "mqtt" ? "planned_publish" : "planned_tag_write",
      topic: event.topic || event.tagPath,
      payload: event.payload,
      qos: 0,
      status: "planned",
      metadata: dbJson(event),
    });
  }

  const shouldPublish = runtime.commandDryRunPublish;
  let status = "dry_run_planned";
  let published = 0;

  if (shouldPublish) {
    try {
      const publishResult = await publishMqttEvents(plannedEvents, deps);
      published = publishResult.published;
      status = "dry_run_published";

      await db("sandbox_mqtt_events")
        .where({
          command_run_id: runId,
          direction: "outbound",
          event_type: "planned_publish",
        })
        .update({ status: "published" });
    } catch (error) {
      status = "sandbox_failed";
      await db("command_runs").where({ id: runId }).update({
        status,
        error: error.message,
        updated_at: db.fn.now(),
      });
      await db("sandbox_mqtt_events")
        .where({
          command_run_id: runId,
          direction: "outbound",
          event_type: "planned_publish",
        })
        .update({ status: "failed" });

      throw commandError(
        503,
        "sandbox_unavailable",
        `Dry-run planned, but sandbox broker publish failed: ${error.message}`,
        { runId, plannedEvents },
      );
    }
  }

  await db("command_runs").where({ id: runId }).update({
    status,
    updated_at: db.fn.now(),
  });

  await audit({
    userId: user?.id || null,
    username: user?.username || "unknown",
    action: "COMMAND_DRY_RUN",
    targetType: "COMMAND",
    targetId: runId,
    details: {
      commandKey,
      mode: "dry_run",
      status,
      target,
      params,
      plannedEvents,
      published,
    },
    ipAddress,
  });

  return {
    success: true,
    dryRun: true,
    runId,
    status,
    plannedEvents,
    message: `Dry-run command ${commandKey} planned${shouldPublish ? " and published to sandbox" : ""}.`,
  };
}

async function listCatalog() {
  return knex("command_catalog")
    .orderBy("family", "asc")
    .orderBy("command_key", "asc");
}

async function listRuns({ limit = 50 } = {}, deps = {}) {
  const db = deps.knex || knex;
  const runs = await db("command_runs")
    .orderBy("created_at", "desc")
    .limit(Math.min(Number(limit) || 50, 200));
  if (runs.length === 0) return [];

  const runIds = runs.map((run) => run.id);
  const events = await db("sandbox_mqtt_events")
    .whereIn("command_run_id", runIds)
    .orderBy("created_at", "asc")
    .orderBy("id", "asc");

  return runs.map((run) =>
    decorateRun(
      run,
      events.filter((event) => event.command_run_id === run.id),
    ),
  );
}

async function getRun(id, deps = {}) {
  const db = deps.knex || knex;
  const run = await db("command_runs").where({ id }).first();
  if (!run) return null;

  const events = await db("sandbox_mqtt_events")
    .where({ command_run_id: run.id })
    .orderBy("created_at", "asc")
    .orderBy("id", "asc");

  return decorateRun(run, events);
}

module.exports = {
  buildPlannedEvents,
  commandError,
  decorateRun,
  executeCommand,
  getRun,
  interpolate,
  listCatalog,
  listRuns,
  parseMaybeJson,
  publishMqttEvents,
  summarizeRunEvents,
};
