const migration = require("../../db/migrations/20260601000100_add_architecture_commands_sandbox");

function makeTableProxy() {
  const proxy = new Proxy(
    {},
    {
      get(_target, prop) {
        if (prop === "then") return undefined;
        return jest.fn(() => proxy);
      },
    },
  );
  return proxy;
}

function makeKnex() {
  const created = [];
  const dropped = [];
  return {
    created,
    dropped,
    fn: { now: jest.fn(() => "now") },
    schema: {
      createTable: jest.fn(async (name, callback) => {
        created.push(name);
        callback(makeTableProxy());
      }),
      dropTableIfExists: jest.fn(async (name) => {
        dropped.push(name);
      }),
    },
  };
}

describe("architecture and command sandbox migration", () => {
  test("creates all planned tables", async () => {
    const knex = makeKnex();

    await migration.up(knex);

    expect(knex.created).toEqual([
      "architecture_sites",
      "architecture_postes",
      "architecture_cellules",
      "architecture_equipements",
      "architecture_onduleurs",
      "architecture_imports",
      "command_catalog",
      "command_runs",
      "sandbox_mqtt_events",
    ]);
  });

  test("drops tables in reverse dependency order", async () => {
    const knex = makeKnex();

    await migration.down(knex);

    expect(knex.dropped).toEqual([
      "sandbox_mqtt_events",
      "command_runs",
      "command_catalog",
      "architecture_imports",
      "architecture_onduleurs",
      "architecture_equipements",
      "architecture_cellules",
      "architecture_postes",
      "architecture_sites",
    ]);
  });
});
