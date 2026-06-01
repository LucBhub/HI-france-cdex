process.env.JWT_SECRET = "test-secret";
process.env.COMMAND_LIVE_ENABLED = "false";

const express = require("express");
const jwt = require("jsonwebtoken");
const request = require("supertest");

jest.mock("../../db/knex", () => jest.fn());
jest.mock("../../services/command-service", () => ({
  executeCommand: jest.fn(),
}));
jest.mock("modbus-serial", () => jest.fn());

const knex = require("../../db/knex");
const { executeCommand } = require("../../services/command-service");
const ModbusRTU = require("modbus-serial");
const plantsRouter = require("../../routes/plants");

const app = express();
app.use(express.json());
app.use("/", plantsRouter);

function token() {
  return jwt.sign({ id: 1, username: "alice", role: "member" }, "test-secret");
}

describe("legacy plant command wrappers", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.COMMAND_LIVE_ENABLED = "false";
    executeCommand.mockResolvedValue({
      success: true,
      dryRun: true,
      runId: 33,
      status: "dry_run_planned",
      plannedEvents: [{ topic: "legacy/plants/1/relays/2/control/couple" }],
      message: "planned",
    });
  });

  test("single relay command uses command_service dry-run and does not instantiate Modbus", async () => {
    const res = await request(app)
      .post("/1/relays/2/control")
      .set("Authorization", `Bearer ${token()}`)
      .send({ command: "couple" });

    expect(res.status).toBe(200);
    expect(res.body.dryRun).toBe(true);
    expect(res.body.runId).toBe(33);
    expect(executeCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        commandKey: "legacy.relay.couple",
        target: { plantId: "1", relayId: "2" },
      }),
    );
    expect(ModbusRTU).not.toHaveBeenCalled();
  });

  test("control-all dry-run returns compatible relay results", async () => {
    knex.mockReturnValue({
      where: jest.fn().mockResolvedValue([{ id: 2 }, { id: 3 }]),
    });

    const res = await request(app)
      .post("/1/relays/control-all")
      .set("Authorization", `Bearer ${token()}`)
      .send({ command: "decouple" });

    expect(res.status).toBe(200);
    expect(res.body.dryRun).toBe(true);
    expect(res.body.results).toHaveLength(2);
    expect(res.body.summary).toEqual({ total: 2, succeeded: 2, failed: 0 });
    expect(executeCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        commandKey: "legacy.relay.decouple",
        target: { plantId: "1", relayId: "all" },
      }),
    );
    expect(ModbusRTU).not.toHaveBeenCalled();
  });
});
