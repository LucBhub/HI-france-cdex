const {
  getCommandRuntimeConfig,
  getPublicRuntimeStatus,
  parseBooleanEnv,
} = require("../../config/runtime");

describe("runtime config", () => {
  test("parses boolean environment values", () => {
    expect(parseBooleanEnv("true", false)).toBe(true);
    expect(parseBooleanEnv("1", false)).toBe(true);
    expect(parseBooleanEnv("yes", false)).toBe(true);
    expect(parseBooleanEnv("false", true)).toBe(false);
    expect(parseBooleanEnv("0", true)).toBe(false);
    expect(parseBooleanEnv("unexpected", false)).toBe(false);
  });

  test("forces command live mode off even when env requests it", () => {
    const config = getCommandRuntimeConfig({
      COMMAND_MODE: "live",
      COMMAND_LIVE_ENABLED: "true",
      COMMAND_DRY_RUN_PUBLISH: "false",
      MQTT_URL: "mqtt://broker:1883",
    });

    expect(config.commandMode).toBe("dry_run");
    expect(config.requestedMode).toBe("live");
    expect(config.commandLiveEnabled).toBe(false);
    expect(config.requestedLiveEnabled).toBe(true);
    expect(config.commandDryRunPublish).toBe(false);
    expect(config.liveKillSwitch).toBe(true);
  });

  test("public runtime status exposes only non-secret command flags", () => {
    const status = getPublicRuntimeStatus({
      COMMAND_LIVE_ENABLED: "true",
      COMMAND_DRY_RUN_PUBLISH: "true",
      MQTT_URL: "mqtt://broker:1883",
    });

    expect(status).toEqual({
      commands: expect.objectContaining({
        mode: "dry_run",
        liveEnabled: false,
        requestedLiveEnabled: true,
        dryRunPublish: true,
        mqttUrl: "mqtt://broker:1883",
      }),
    });
  });
});
