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

  test("POST / maps live_disabled service errors to 403", async () => {
    const error = new Error("Live disabled");
    error.status = 403;
    error.code = "live_disabled";
    commandService.executeCommand.mockRejectedValue(error);

    const res = await request(app)
      .post("/")
      .set("Authorization", `Bearer ${token("admin")}`)
      .send({ commandKey: "cell.open", mode: "live", target: {} });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe("live_disabled");
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
});
