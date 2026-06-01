process.env.JWT_SECRET = "test-secret";

const express = require("express");
const jwt = require("jsonwebtoken");
const request = require("supertest");

jest.mock("../../services/command-service", () => ({
  executeCommand: jest.fn(),
  getRun: jest.fn(),
  listCatalog: jest.fn(),
  listRuns: jest.fn(),
}));

const commandService = require("../../services/command-service");
const commandsRouter = require("../../routes/commands");

const app = express();
app.use(express.json());
app.use("/", commandsRouter);

function token(role = "member") {
  return jwt.sign({ id: 1, username: "alice", role }, "test-secret");
}

describe("commands routes", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("POST / requires commandKey", async () => {
    const res = await request(app)
      .post("/")
      .set("Authorization", `Bearer ${token()}`)
      .send({ target: {} });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("missing_command_key");
  });

  test("POST / rejects any non dry-run mode before service execution", async () => {
    const res = await request(app)
      .post("/")
      .set("Authorization", `Bearer ${token("admin")}`)
      .send({ commandKey: "cell.open", mode: "live", target: {} });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe("live_disabled");
    expect(commandService.executeCommand).not.toHaveBeenCalled();
  });

  test("POST / requires target and params to be objects", async () => {
    const targetRes = await request(app)
      .post("/")
      .set("Authorization", `Bearer ${token()}`)
      .send({ commandKey: "cell.open", target: [] });

    expect(targetRes.status).toBe(400);
    expect(targetRes.body.code).toBe("invalid_target");

    const paramsRes = await request(app)
      .post("/")
      .set("Authorization", `Bearer ${token()}`)
      .send({ commandKey: "cell.open", params: "bad" });

    expect(paramsRes.status).toBe(400);
    expect(paramsRes.body.code).toBe("invalid_params");
  });

  test("POST / returns dry-run execution result", async () => {
    commandService.executeCommand.mockResolvedValue({
      success: true,
      dryRun: true,
      runId: 12,
      status: "dry_run_planned",
      plannedEvents: [],
      message: "planned",
    });

    const res = await request(app)
      .post("/")
      .set("Authorization", `Bearer ${token()}`)
      .send({ commandKey: "legacy.relay.couple", target: { plantId: 1, relayId: 2 } });

    expect(res.status).toBe(200);
    expect(res.body.runId).toBe(12);
    expect(commandService.executeCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        commandKey: "legacy.relay.couple",
        mode: "dry_run",
      }),
    );
  });

  test("GET /runs/:id returns run with sandbox events", async () => {
    commandService.getRun.mockResolvedValue({
      id: 12,
      command_key: "legacy.relay.couple",
      events: [{ id: 20, event_type: "simulator_ack" }],
    });

    const res = await request(app)
      .get("/runs/12")
      .set("Authorization", `Bearer ${token()}`);

    expect(res.status).toBe(200);
    expect(res.body.run.events).toHaveLength(1);
    expect(commandService.getRun).toHaveBeenCalledWith("12");
  });

  test("GET /runs/:id/status returns observability summary and timeline", async () => {
    commandService.getRun.mockResolvedValue({
      id: 12,
      command_key: "legacy.relay.couple",
      status: "dry_run_published",
      dry_run: true,
      eventSummary: { sandboxStatus: "acknowledged", hasSimulatorAck: true },
      timeline: [{ id: 20, type: "simulator_ack" }],
    });

    const res = await request(app)
      .get("/runs/12/status")
      .set("Authorization", `Bearer ${token()}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      success: true,
      runId: 12,
      commandKey: "legacy.relay.couple",
      eventSummary: { sandboxStatus: "acknowledged" },
      timeline: [{ id: 20, type: "simulator_ack" }],
    });
  });

  test("GET /runs/:id/status returns 404 for missing run", async () => {
    commandService.getRun.mockResolvedValue(null);

    const res = await request(app)
      .get("/runs/99/status")
      .set("Authorization", `Bearer ${token()}`);

    expect(res.status).toBe(404);
    expect(res.body.code).toBe("run_not_found");
  });
});
