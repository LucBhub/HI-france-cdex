process.env.JWT_SECRET = "test-secret";

const express = require("express");
const jwt = require("jsonwebtoken");
const request = require("supertest");

const imports = [
  {
    id: 1,
    source: "ignition_export_architecture_metadata",
    status: "metadata_only",
  },
];
const tableCounts = {
  architecture_sites: 2,
  architecture_postes: 3,
  architecture_cellules: 5,
  architecture_equipements: 7,
  architecture_onduleurs: 11,
  command_catalog: 15,
};
const sitesByClient = [
  { client: "REDEN", count: "1" },
  { client: null, count: "1" },
];

jest.mock("../../db/knex", () => {
  return function knex(table) {
    const rows = table === "architecture_imports" ? imports : [];
    const state = { table, limit: null, groupByClient: false, distinctSites: false };
    const execute = () => {
      if (state.groupByClient) return sitesByClient;
      if (rows.length && state.limit !== null) return rows.slice(0, state.limit);
      if (rows.length) return rows;
      return [];
    };
    const chain = {
      count() {
        return chain;
      },
      countDistinct() {
        state.distinctSites = true;
        return chain;
      },
      first() {
        if (state.distinctSites) return Promise.resolve({ count: "1" });
        return Promise.resolve({ count: String(tableCounts[table] || 0) });
      },
      select() {
        return chain;
      },
      leftJoin() {
        return chain;
      },
      whereNotNull() {
        return chain;
      },
      groupBy(field) {
        state.groupByClient = field === "client";
        return chain;
      },
      orderBy() {
        return chain;
      },
      limit(limit) {
        state.limit = limit;
        return chain;
      },
      then(resolve, reject) {
        return Promise.resolve(execute()).then(resolve, reject);
      },
    };
    return chain;
  };
});

const architectureRouter = require("../../routes/architecture");

const app = express();
app.use(express.json());
app.use("/", architectureRouter);

function token(role = "member") {
  return jwt.sign({ id: 1, username: "alice", role }, "test-secret");
}

describe("architecture routes", () => {
  test("GET /summary returns architecture counters and imports", async () => {
    const res = await request(app)
      .get("/summary")
      .set("Authorization", `Bearer ${token()}`);

    expect(res.status).toBe(200);
    expect(res.body.summary).toMatchObject({
      sites: 2,
      sitesWithArchitecture: 1,
      sitesWithoutArchitecture: 1,
      postes: 3,
      cellules: 5,
      equipements: 7,
      onduleurs: 11,
      commands: 15,
      imports,
      sitesByClient: [
        { client: "REDEN", count: 1 },
        { client: "unknown", count: 1 },
      ],
    });
  });

  test("GET /imports returns architecture import history", async () => {
    const res = await request(app)
      .get("/imports")
      .set("Authorization", `Bearer ${token()}`);

    expect(res.status).toBe(200);
    expect(res.body.imports).toEqual(imports);
  });
});
