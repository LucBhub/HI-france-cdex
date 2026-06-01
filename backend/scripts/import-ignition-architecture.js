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
  importSiteRows,
  previewCreateTagRows,
  previewSiteRows,
  readCreateTagRowsFile,
  recordIgnitionArchitectureMetadata,
} = require("../lib/ignition-architecture-import");

function parseArgs(argv) {
  const args = {
    apply: false,
    metadataOnly: false,
    sitesPath: null,
    rowsPath: null,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--apply") {
      args.apply = true;
    } else if (arg === "--dry-run") {
      args.apply = false;
    } else if (arg === "--metadata-only") {
      args.metadataOnly = true;
    } else if (arg === "--sites-file") {
      args.sitesPath = argv[index + 1];
      if (!args.sitesPath) {
        throw new Error("--sites-file requires a path.");
      }
      index += 1;
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
  npm run architecture:import -- --sites-file <sites.json|sites.csv>
  npm run architecture:import -- --sites-file <sites.json|sites.csv> <rows.json|rows.csv|rows.tsv>
  npm run architecture:import -- --apply <rows.json|rows.csv|rows.tsv>

Default behavior with a rows file is preview/dry-run. Use --apply to write architecture_* rows.`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    printHelp();
    return;
  }

  if ((!args.rowsPath && !args.sitesPath) || args.metadataOnly) {
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

  const sitesInput = args.sitesPath
    ? readCreateTagRowsFile(args.sitesPath)
    : null;
  const architectureInput = args.rowsPath
    ? readCreateTagRowsFile(args.rowsPath)
    : null;

  if (!args.apply) {
    const sitePreview = sitesInput ? previewSiteRows(sitesInput.rows) : null;
    const architecturePreview = architectureInput
      ? previewCreateTagRows(architectureInput.rows)
      : null;
    console.log(
      JSON.stringify(
        {
          success: true,
          dryRun: true,
          mode: "preview",
          sites: sitePreview
            ? {
                sourceFile: sitesInput.absolutePath,
                stats: sitePreview.stats,
                samples: sitePreview.samples,
              }
            : null,
          architecture: architecturePreview
            ? {
                sourceFile: architectureInput.absolutePath,
                stats: architecturePreview.stats,
                samples: architecturePreview.samples,
              }
            : null,
          message:
            "Preview only. Re-run with --apply to write architecture rows.",
        },
        null,
        2,
      ),
    );
    return;
  }

  const siteResult = sitesInput
    ? await importSiteRows(knex, sitesInput.rows, {
        sourceFile: sitesInput.absolutePath,
      })
    : null;
  const architectureResult = architectureInput
    ? await importCreateTagRows(knex, architectureInput.rows, {
        sourceFile: architectureInput.absolutePath,
      })
    : null;
  console.log(
    JSON.stringify(
      {
        success: true,
        mode: "apply",
        sites: siteResult
          ? {
              sourceFile: sitesInput.absolutePath,
              ...siteResult,
            }
          : null,
        architecture: architectureResult
          ? {
              sourceFile: architectureInput.absolutePath,
              ...architectureResult,
            }
          : null,
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
