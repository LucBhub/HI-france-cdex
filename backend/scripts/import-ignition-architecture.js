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
  previewCreateTagRows,
  readCreateTagRowsFile,
  recordIgnitionArchitectureMetadata,
} = require("../lib/ignition-architecture-import");

function parseArgs(argv) {
  const args = {
    apply: false,
    metadataOnly: false,
    rowsPath: null,
  };

  for (const arg of argv) {
    if (arg === "--apply") {
      args.apply = true;
    } else if (arg === "--dry-run") {
      args.apply = false;
    } else if (arg === "--metadata-only") {
      args.metadataOnly = true;
    } else if (arg === "--help" || arg === "-h") {
      args.help = true;
    } else if (!args.rowsPath) {
      args.rowsPath = arg;
    } else {
      throw new Error(`Unexpected argument: ${arg}`);
    }
  }

  return args;
}

function printHelp() {
  console.log(`Usage:
  npm run architecture:import
  npm run architecture:import -- --metadata-only
  npm run architecture:import -- <rows.json|rows.csv|rows.tsv>
  npm run architecture:import -- --apply <rows.json|rows.csv|rows.tsv>

Default behavior with a rows file is preview/dry-run. Use --apply to write architecture_* rows.`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    printHelp();
    return;
  }

  if (!args.rowsPath || args.metadataOnly) {
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

  const { absolutePath, rows } = readCreateTagRowsFile(args.rowsPath);

  if (!args.apply) {
    const preview = previewCreateTagRows(rows);
    console.log(
      JSON.stringify(
        {
          ...preview,
          mode: "preview",
          sourceFile: absolutePath,
          message:
            "Preview only. Re-run with --apply to write architecture rows.",
        },
        null,
        2,
      ),
    );
    return;
  }

  const result = await importCreateTagRows(knex, rows, {
    sourceFile: absolutePath,
  });
  console.log(
    JSON.stringify(
      {
        ...result,
        mode: "apply",
        sourceFile: absolutePath,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error("[Ignition Architecture Import]", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await knex.destroy();
  });
