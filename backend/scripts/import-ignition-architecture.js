#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const envPath = fs.existsSync(path.join(__dirname, "../.env"))
  ? path.join(__dirname, "../.env")
  : path.join(__dirname, "../../.env");
require("dotenv").config({ path: envPath });

const knex = require("../db/knex");
const {
  importCreateTagRows,
  recordIgnitionArchitectureMetadata,
} = require("../lib/ignition-architecture-import");

async function main() {
  const rowsPath = process.argv[2];

  if (!rowsPath) {
    const result = await recordIgnitionArchitectureMetadata(knex);
    console.log(
      JSON.stringify(
        {
          success: true,
          mode: "metadata_only",
          ...result,
        },
        null,
        2,
      ),
    );
    return;
  }

  const absoluteRowsPath = path.resolve(process.cwd(), rowsPath);
  const payload = JSON.parse(fs.readFileSync(absoluteRowsPath, "utf8"));
  const rows = Array.isArray(payload) ? payload : payload.rows;
  if (!Array.isArray(rows)) {
    throw new Error("Rows file must be an array or an object with a rows array.");
  }

  const result = await importCreateTagRows(knex, rows, {
    sourceFile: absoluteRowsPath,
  });
  console.log(JSON.stringify(result, null, 2));
}

main()
  .catch((error) => {
    console.error("[Ignition Architecture Import]", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await knex.destroy();
  });
