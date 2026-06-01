const mqtt = require("mqtt");
const knex = require("./db/knex");

const MQTT_URL = process.env.MQTT_URL || "mqtt://localhost:1883";
const ACK_TOPIC = process.env.MQTT_SIMULATOR_ACK_TOPIC || "sandbox/acks";
const MATCH_WINDOW_MS = Number(
  process.env.MQTT_SIMULATOR_MATCH_WINDOW_MS || 300000,
);

function safePayload(payload) {
  if (Buffer.isBuffer(payload)) return payload.toString("utf8");
  return String(payload || "");
}

async function logEvent(row, db = knex) {
  try {
    await db("sandbox_mqtt_events").insert(row);
  } catch (error) {
    console.error("[MQTT Simulator] Failed to log event:", error.message);
  }
}

async function findMatchingOutboundEvent(topic, payloadText, db = knex) {
  const since = new Date(Date.now() - MATCH_WINDOW_MS);
  return db("sandbox_mqtt_events")
    .where({
      direction: "outbound",
      event_type: "planned_publish",
      topic,
      payload: payloadText,
    })
    .where("created_at", ">=", since)
    .orderBy("created_at", "desc")
    .orderBy("id", "desc")
    .first();
}

function buildAck({ topic, payloadText, matchedEvent }) {
  return {
    ok: true,
    topic,
    payload: payloadText,
    commandRunId: matchedEvent?.command_run_id || null,
    receivedAt: new Date().toISOString(),
    simulator: "hyperviseur-sandbox",
  };
}

function publish(client, topic, payload) {
  return new Promise((resolve, reject) => {
    client.publish(topic, payload, { qos: 0 }, (error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

async function handleMessage(client, topic, payload, deps = {}) {
  if (topic.startsWith("sandbox/")) return;

  const db = deps.knex || knex;
  const ackTopic = deps.ackTopic || ACK_TOPIC;
  const payloadText = safePayload(payload);
  console.log(`[MQTT Simulator] ${topic} -> ${payloadText}`);

  const matchedEvent = await findMatchingOutboundEvent(topic, payloadText, db);
  const commandRunId = matchedEvent?.command_run_id || null;

  await logEvent(
    {
      command_run_id: commandRunId,
      direction: "inbound",
      event_type: "simulator_received",
      topic,
      payload: payloadText,
      qos: 0,
      status: "received",
      metadata: JSON.stringify({
        source: "mqtt-simulator",
        matchedOutboundEventId: matchedEvent?.id || null,
      }),
    },
    db,
  );

  const ack = buildAck({ topic, payloadText, matchedEvent });
  const ackPayload = JSON.stringify(ack);

  try {
    await publish(client, ackTopic, ackPayload);
    await logEvent(
      {
        command_run_id: commandRunId,
        direction: "outbound",
        event_type: "simulator_ack",
        topic: ackTopic,
        payload: ackPayload,
        qos: 0,
        status: "published",
        metadata: JSON.stringify({ source: "mqtt-simulator" }),
      },
      db,
    );
  } catch (error) {
    await logEvent(
      {
        command_run_id: commandRunId,
        direction: "outbound",
        event_type: "simulator_ack",
        topic: ackTopic,
        payload: ackPayload,
        qos: 0,
        status: "failed",
        metadata: JSON.stringify({
          source: "mqtt-simulator",
          error: error.message,
        }),
      },
      db,
    );
    console.error("[MQTT Simulator] ACK publish failed:", error.message);
  }
}

function startSimulator() {
  const client = mqtt.connect(MQTT_URL, {
    connectTimeout: Number(process.env.MQTT_CONNECT_TIMEOUT_MS || 3000),
    reconnectPeriod: Number(process.env.MQTT_RECONNECT_MS || 2000),
  });

  client.on("connect", () => {
    console.log(`[MQTT Simulator] Connected to ${MQTT_URL}`);
    client.subscribe("#", (error) => {
      if (error) {
        console.error("[MQTT Simulator] Subscribe failed:", error.message);
      } else {
        console.log("[MQTT Simulator] Subscribed to #");
      }
    });
  });

  client.on("message", (topic, payload) => {
    handleMessage(client, topic, payload).catch((error) => {
      console.error("[MQTT Simulator] Message handling failed:", error.message);
    });
  });

  client.on("error", (error) => {
    console.error("[MQTT Simulator] MQTT error:", error.message);
  });

  const shutdown = async () => {
    console.log("[MQTT Simulator] Shutting down...");
    client.end(true);
    await knex.destroy();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

if (require.main === module) {
  startSimulator();
}

module.exports = {
  buildAck,
  findMatchingOutboundEvent,
  handleMessage,
  logEvent,
  safePayload,
  startSimulator,
};
