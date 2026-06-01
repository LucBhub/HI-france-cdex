const TRUE_VALUES = new Set(["true", "1", "yes", "y", "on"]);
const FALSE_VALUES = new Set(["false", "0", "no", "n", "off", ""]);

function parseBooleanEnv(value, defaultValue = false) {
  if (typeof value === "boolean") return value;
  if (value === undefined || value === null) return defaultValue;

  const normalized = String(value).trim().toLowerCase();
  if (TRUE_VALUES.has(normalized)) return true;
  if (FALSE_VALUES.has(normalized)) return false;
  return defaultValue;
}

function getCommandRuntimeConfig(env = process.env) {
  const requestedMode = env.COMMAND_MODE || "dry_run";
  const requestedLiveEnabled = parseBooleanEnv(env.COMMAND_LIVE_ENABLED, false);

  return {
    commandMode: "dry_run",
    requestedMode,
    commandLiveEnabled: false,
    requestedLiveEnabled,
    commandDryRunPublish: parseBooleanEnv(env.COMMAND_DRY_RUN_PUBLISH, true),
    mqttUrl: env.MQTT_URL || "mqtt://localhost:1883",
    mqttConnectTimeoutMs: Number(env.MQTT_CONNECT_TIMEOUT_MS || 1500),
    liveKillSwitch: true,
  };
}

function getPublicRuntimeStatus(env = process.env) {
  const command = getCommandRuntimeConfig(env);
  return {
    commands: {
      mode: command.commandMode,
      requestedMode: command.requestedMode,
      liveEnabled: command.commandLiveEnabled,
      requestedLiveEnabled: command.requestedLiveEnabled,
      dryRunPublish: command.commandDryRunPublish,
      mqttUrl: command.mqttUrl,
      liveKillSwitch: command.liveKillSwitch,
    },
  };
}

module.exports = {
  getCommandRuntimeConfig,
  getPublicRuntimeStatus,
  parseBooleanEnv,
};
