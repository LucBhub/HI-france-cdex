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

jest.mock("../../db/knex", () => {
  return function knex(table) {
    const rows = table === "architecture_imports" ? imports : [];
    const chain = {
      orderBy() {
        return chain;
      },
      limit(limit) {
        return Promise.resolve(rows.slice(0, limit));
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
  test("GET /imports returns architecture import history", async () => {
    const res = await request(app)
      .get("/imports")
      .set("Authorization", `Bearer ${token()}`);

    expect(res.status).toBe(200);
    expect(res.body.imports).toEqual(imports);
  });
});
