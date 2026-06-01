const mqtt = require("mqtt");
const knex = require("./db/knex");

const MQTT_URL = process.env.MQTT_URL || "mqtt://localhost:1883";
const ACK_TOPIC = process.env.MQTT_SIMULATOR_ACK_TOPIC || "sandbox/acks";

function safePayload(payload) {
  if (Buffer.isBuffer(payload)) return payload.toString("utf8");
  return String(payload || "");
}

async function logEvent(row) {
  try {
    await knex("sandbox_mqtt_events").insert(row);
  } catch (error) {
    console.error("[MQTT Simulator] Failed to log event:", error.message);
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

  client.on("message", async (topic, payload) => {
    if (topic.startsWith("sandbox/")) return;

    const payloadText = safePayload(payload);
    console.log(`[MQTT Simulator] ${topic} -> ${payloadText}`);

    await logEvent({
      direction: "inbound",
      event_type: "simulator_received",
      topic,
      payload: payloadText,
      qos: 0,
      status: "received",
      metadata: JSON.stringify({ source: "mqtt-simulator" }),
    });

    const ack = {
      ok: true,
      topic,
      payload: payloadText,
      receivedAt: new Date().toISOString(),
      simulator: "hyperviseur-sandbox",
    };

    client.publish(ACK_TOPIC, JSON.stringify(ack), { qos: 0 }, (error) => {
      if (error) {
        console.error("[MQTT Simulator] ACK publish failed:", error.message);
      }
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

startSimulator();
