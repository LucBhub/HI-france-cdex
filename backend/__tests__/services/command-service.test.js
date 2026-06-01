const EventEmitter = require("events");
const {
  buildPlannedEvents,
  decorateRun,
  executeCommand,
  getRun,
  listRuns,
  summarizeRunEvents,
} = require("../../services/command-service");

function matches(row, criteria) {
  if (typeof criteria === "function") return criteria(row);
  return Object.entries(criteria || {}).every(([key, value]) => row[key] === value);
}

function makeDb(initial = {}) {
  const data = {
    command_catalog: [],
    command_runs: [],
    sandbox_mqtt_events: [],
    ...initial,
  };
  const nextIds = {
    command_runs: data.command_runs.length + 1,
    sandbox_mqtt_events: data.sandbox_mqtt_events.length + 1,
  };

  function db(table) {
    const state = { criteria: null };
    const selectedRows = () =>
      data[table].filter((row) => matches(row, state.criteria));
    const chain = {
      where(criteria) {
        state.criteria = criteria;
        return chain;
      },
      whereIn(key, values) {
        state.criteria = (row) => values.includes(row[key]);
        return chain;
      },
      orderBy() {
        return chain;
      },
      limit() {
        return chain;
      },
      async first() {
        return selectedRows()[0];
      },
      insert(row) {
        const id = nextIds[table] || data[table].length + 1;
        nextIds[table] = id + 1;
        data[table].push({ id, ...row });
        const result = Promise.resolve([id]);
        result.returning = async () => [id];
        return result;
      },
      async update(row) {
        const rows = selectedRows();
        rows.forEach((item) => Object.assign(item, row));
        return rows.length;
      },
      then(resolve, reject) {
        return Promise.resolve(selectedRows()).then(resolve, reject);
      },
    };
    return chain;
  }

  db.data = data;
  db.fn = { now: jest.fn(() => "now") };
  return db;
}

const catalogRow = {
  command_key: "legacy.relay.couple",
  template: {
    requiredTarget: ["plantId", "relayId"],
    topicTemplates: ["legacy/plants/{plantId}/relays/{relayId}/control/couple"],
    payloadSequence: ["true"],
  },
};

describe("command-service", () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...OLD_ENV };
    process.env.COMMAND_LIVE_ENABLED = "false";
    process.env.COMMAND_DRY_RUN_PUBLISH = "false";
  });

  afterAll(() => {
    process.env = OLD_ENV;
  });

  test("builds planned MQTT events from catalog templates", () => {
    const events = buildPlannedEvents(catalogRow, { plantId: 1, relayId: 2 });

    expect(events).toEqual([
      {
        sequence: 1,
        transport: "mqtt",
        topic: "legacy/plants/1/relays/2/control/couple",
        payload: "true",
        plannedPulseMs: 0,
      },
    ]);
  });

  test("summarizes simulator event progression", () => {
    const summary = summarizeRunEvents([
      {
        event_type: "planned_publish",
        status: "published",
        created_at: "2026-06-01T10:00:00.000Z",
      },
      {
        event_type: "simulator_received",
        status: "received",
        created_at: "2026-06-01T10:00:01.000Z",
      },
      {
        event_type: "simulator_ack",
        status: "published",
        created_at: "2026-06-01T10:00:02.000Z",
      },
    ]);

    expect(summary).toMatchObject({
      totalEvents: 3,
      plannedPublishes: 1,
      publishedPublishes: 1,
      simulatorReceipts: 1,
      simulatorAcks: 1,
      hasSimulatorAck: true,
      sandboxStatus: "acknowledged",
      lastEventAt: "2026-06-01T10:00:02.000Z",
    });
  });

  test("decorates runs with parsed JSON fields, event summary and timeline", () => {
    const run = decorateRun(
      {
        id: 1,
        target: "{\"plantId\":1}",
        params: "{}",
        planned_events: "[]",
      },
      [
        {
          id: 2,
          command_run_id: 1,
          direction: "outbound",
          event_type: "simulator_ack",
          topic: "sandbox/acks",
          payload: "{}",
          status: "published",
          metadata: "{\"matchedOutboundEventId\":1}",
          created_at: "2026-06-01T10:00:00.000Z",
        },
      ],
    );

    expect(run.target).toEqual({ plantId: 1 });
    expect(run.eventSummary.sandboxStatus).toBe("acknowledged");
    expect(run.timeline).toEqual([
      expect.objectContaining({
        id: 2,
        type: "simulator_ack",
        matchedOutboundEventId: 1,
      }),
    ]);
  });

  test("rejects unknown commands", async () => {
    const db = makeDb();

    await expect(
      executeCommand(
        { commandKey: "missing", target: {}, params: {}, user: { username: "u" } },
        { knex: db, logAudit: jest.fn() },
      ),
    ).rejects.toMatchObject({ status: 404, code: "unknown_command" });
  });

  test("rejects incomplete targets", async () => {
    const db = makeDb({ command_catalog: [catalogRow] });

    await expect(
      executeCommand(
        { commandKey: "legacy.relay.couple", target: { plantId: 1 }, user: { username: "u" } },
        { knex: db, logAudit: jest.fn() },
      ),
    ).rejects.toMatchObject({ status: 400, code: "missing_field" });
  });

  test("rejects live mode before touching the database", async () => {
    const db = makeDb({ command_catalog: [catalogRow] });

    await expect(
      executeCommand(
        { commandKey: "legacy.relay.couple", mode: "live", target: {}, user: { username: "u" } },
        { knex: db, logAudit: jest.fn() },
      ),
    ).rejects.toMatchObject({ status: 403, code: "live_disabled" });

    expect(db.data.command_runs).toHaveLength(0);
  });

  test("still executes dry-run when COMMAND_LIVE_ENABLED is true", async () => {
    process.env.COMMAND_LIVE_ENABLED = "true";
    const db = makeDb({ command_catalog: [catalogRow] });

    const result = await executeCommand(
      {
        commandKey: "legacy.relay.couple",
        mode: "dry_run",
        target: { plantId: 1, relayId: 2 },
        user: { username: "u" },
      },
      { knex: db, logAudit: jest.fn() },
    );

    expect(result.dryRun).toBe(true);
    expect(result.status).toBe("dry_run_planned");
    expect(db.data.command_runs).toHaveLength(1);
  });

  test("creates command run, sandbox event and audit log in dry-run", async () => {
    const db = makeDb({ command_catalog: [catalogRow] });
    const audit = jest.fn().mockResolvedValue(undefined);

    const result = await executeCommand(
      {
        commandKey: "legacy.relay.couple",
        target: { plantId: 1, relayId: 2 },
        user: { id: 7, username: "alice" },
        ipAddress: "127.0.0.1",
      },
      { knex: db, logAudit: audit },
    );

    expect(result.success).toBe(true);
    expect(result.dryRun).toBe(true);
    expect(db.data.command_runs).toHaveLength(1);
    expect(db.data.sandbox_mqtt_events).toHaveLength(1);
    expect(audit).toHaveBeenCalledWith(
      expect.objectContaining({ action: "COMMAND_DRY_RUN", targetId: 1 }),
    );
  });

  test("marks the run as sandbox_failed when broker publish fails", async () => {
    process.env.COMMAND_DRY_RUN_PUBLISH = "true";
    const db = makeDb({ command_catalog: [catalogRow] });
    const mqtt = {
      connect: jest.fn(() => {
        const client = new EventEmitter();
        client.publish = jest.fn();
        client.end = jest.fn();
        process.nextTick(() => client.emit("error", new Error("broker down")));
        return client;
      }),
    };

    await expect(
      executeCommand(
        {
          commandKey: "legacy.relay.couple",
          target: { plantId: 1, relayId: 2 },
          user: { username: "alice" },
        },
        { knex: db, logAudit: jest.fn(), mqtt },
      ),
    ).rejects.toMatchObject({ status: 503, code: "sandbox_unavailable" });

    expect(db.data.command_runs[0].status).toBe("sandbox_failed");
    expect(db.data.sandbox_mqtt_events[0].status).toBe("failed");
  });

  test("getRun returns the run with sandbox events", async () => {
    const db = makeDb({
      command_runs: [{ id: 1, command_key: "legacy.relay.couple" }],
      sandbox_mqtt_events: [
        { id: 2, command_run_id: 1, event_type: "planned_publish" },
      ],
    });

    const run = await getRun(1, { knex: db });

    expect(run).toMatchObject({
      id: 1,
      events: [{ id: 2, command_run_id: 1 }],
      eventSummary: { totalEvents: 1 },
    });
  });

  test("listRuns decorates each run with its own event summary", async () => {
    const db = makeDb({
      command_runs: [
        { id: 1, command_key: "legacy.relay.couple" },
        { id: 2, command_key: "legacy.relay.decouple" },
      ],
      sandbox_mqtt_events: [
        {
          id: 3,
          command_run_id: 1,
          event_type: "simulator_ack",
          status: "published",
        },
        {
          id: 4,
          command_run_id: 2,
          event_type: "planned_publish",
          status: "published",
        },
      ],
    });

    const runs = await listRuns({ limit: 50 }, { knex: db });

    expect(runs).toHaveLength(2);
    expect(runs[0].eventSummary.sandboxStatus).toBe("acknowledged");
    expect(runs[1].eventSummary.sandboxStatus).toBe("published");
  });
});
