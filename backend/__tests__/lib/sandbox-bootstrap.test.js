const {
  backfillArchitectureSites,
  normalizeSiteCode,
  parseGps,
  readCatalog,
  seedCommandCatalog,
} = require("../../lib/sandbox-bootstrap");

function matches(row, criteria) {
  return Object.entries(criteria || {}).every(([key, value]) => row[key] === value);
}

function makeDb(initial = {}) {
  const data = {
    command_catalog: [],
    plants: [],
    architecture_sites: [],
    architecture_imports: [],
    ...initial,
  };
  const nextIds = {};

  function db(table) {
    const state = { criteria: null };
    const chain = {
      where(criteria) {
        state.criteria = criteria;
        return chain;
      },
      async first() {
        return data[table].find((row) => matches(row, state.criteria));
      },
      select() {
        return Promise.resolve(data[table]);
      },
      insert(row) {
        nextIds[table] = nextIds[table] || data[table].length + 1;
        data[table].push({ id: nextIds[table]++, ...row });
        return Promise.resolve([data[table][data[table].length - 1].id]);
      },
      async update(row) {
        const target = data[table].find((item) => matches(item, state.criteria));
        if (target) Object.assign(target, row);
        return target ? 1 : 0;
      },
    };
    return chain;
  }

  db.data = data;
  db.fn = { now: jest.fn(() => "now") };
  return db;
}

describe("sandbox bootstrap", () => {
  test("normalizes site codes and parses GPS", () => {
    expect(normalizeSiteCode("Plan Auron")).toBe("PLAN_AURON");
    expect(parseGps("44.1, -0.5")).toEqual({ latitude: 44.1, longitude: -0.5 });
    expect(parseGps("bad")).toEqual({ latitude: null, longitude: null });
  });

  test("seeds command catalog idempotently", async () => {
    const db = makeDb();
    const catalogSize = readCatalog().length;

    await seedCommandCatalog(db);
    await seedCommandCatalog(db);

    expect(db.data.command_catalog).toHaveLength(catalogSize);
    expect(db.data.command_catalog.every((row) => row.live_enabled === false)).toBe(true);
    expect(
      db.data.command_catalog.every((row) => row.validation_status === "inferred"),
    ).toBe(true);
  });

  test("backfills only architecture sites from legacy plants", async () => {
    const db = makeDb({
      plants: [
        {
          id: 10,
          name: "Carpentras",
          status: "online",
          gps: "44.05, 5.04",
          address: "route test",
          ce: "CE Sud",
        },
      ],
    });

    await backfillArchitectureSites(db);

    expect(db.data.architecture_sites).toHaveLength(1);
    expect(db.data.architecture_sites[0].site_code).toBe("CARPENTRAS");
    expect(db.data.architecture_imports[0].source).toBe("plants_backfill");
  });
});
