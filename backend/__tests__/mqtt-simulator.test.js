jest.mock("../db/knex", () => jest.fn());

const {
  buildAck,
  handleMessage,
  safePayload,
} = require("../mqtt-simulator");

function makeDb(match) {
  const inserts = [];

  function db() {
    const chain = {
      where: jest.fn(() => chain),
      orderBy: jest.fn(() => chain),
      first: jest.fn(async () => match),
      insert: jest.fn(async (row) => {
        inserts.push(row);
        return [inserts.length];
      }),
    };
    return chain;
  }

  db.inserts = inserts;
  return db;
}

describe("mqtt-simulator", () => {
  test("safePayload converts buffers to text", () => {
    expect(safePayload(Buffer.from("true"))).toBe("true");
    expect(safePayload("false")).toBe("false");
  });

  test("buildAck includes matched command run id when available", () => {
    const ack = buildAck({
      topic: "legacy/plants/1/relays/2/control/couple",
      payloadText: "true",
      matchedEvent: { command_run_id: 44 },
    });

    expect(ack).toEqual(
      expect.objectContaining({
        ok: true,
        commandRunId: 44,
        simulator: "hyperviseur-sandbox",
      }),
    );
  });

  test("handleMessage logs inbound event and published ACK with command_run_id", async () => {
    const db = makeDb({ id: 7, command_run_id: 44 });
    const client = {
      publish: jest.fn((_topic, _payload, _options, callback) => callback()),
    };

    await handleMessage(
      client,
      "legacy/plants/1/relays/2/control/couple",
      Buffer.from("true"),
      { knex: db, ackTopic: "sandbox/acks" },
    );

    expect(client.publish).toHaveBeenCalledWith(
      "sandbox/acks",
      expect.stringContaining('"commandRunId":44'),
      { qos: 0 },
      expect.any(Function),
    );
    expect(db.inserts).toHaveLength(2);
    expect(db.inserts[0]).toMatchObject({
      command_run_id: 44,
      direction: "inbound",
      event_type: "simulator_received",
      status: "received",
    });
    expect(db.inserts[1]).toMatchObject({
      command_run_id: 44,
      direction: "outbound",
      event_type: "simulator_ack",
      topic: "sandbox/acks",
      status: "published",
    });
  });

  test("handleMessage ignores sandbox topics", async () => {
    const db = makeDb(null);
    const client = { publish: jest.fn() };

    await handleMessage(client, "sandbox/acks", "{}", { knex: db });

    expect(client.publish).not.toHaveBeenCalled();
    expect(db.inserts).toHaveLength(0);
  });
});
