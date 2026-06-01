#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const DEFAULT_EXPORT_DIR = path.join(
  __dirname,
  "../../backups/ignition-exports",
);
const DEFAULT_TEST_STACK_DB = {
  DB_HOST: "localhost",
  DB_PORT: "5435",
  DB_USER: "postgres",
  DB_PASS: "postgres",
  DB_NAME: "hyperviseur",
  DB_SSL: "false",
};

function parseArgs(argv) {
  const args = {
    apply: false,
    exportDir: DEFAULT_EXPORT_DIR,
    rowsPath: null,
    sitesPath: null,
    testStack: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--apply") {
      args.apply = true;
    } else if (arg === "--preview" || arg === "--dry-run") {
      args.apply = false;
    } else if (arg === "--test-stack") {
      args.testStack = true;
    } else if (arg === "--export-dir") {
      args.exportDir = argv[index + 1];
      if (!args.exportDir) throw new Error("--export-dir requires a path.");
      index += 1;
    } else if (arg === "--sites-file") {
      args.sitesPath = argv[index + 1];
      if (!args.sitesPath) throw new Error("--sites-file requires a path.");
      index += 1;
    } else if (arg === "--rows-file") {
      args.rowsPath = argv[index + 1];
      if (!args.rowsPath) throw new Error("--rows-file requires a path.");
      index += 1;
    } else if (arg.startsWith("--db-")) {
      const key = arg
        .slice(5)
        .replace(/-/g, "_")
        .toUpperCase();
      const value = argv[index + 1];
      if (!value) throw new Error(`${arg} requires a value.`);
      args[`DB_${key}`] = value;
      index += 1;
    } else if (arg === "--help" || arg === "-h") {
      args.help = true;
    } else {
      throw new Error(`Unexpected argument: ${arg}`);
    }
  }

  return args;
}

function printHelp() {
  console.log(`Usage:
  npm run architecture:france:preview
  npm run architecture:france:load
  node scripts/load-france-sandbox-data.js --test-stack --apply

Options:
  --apply                    Write rows to the target database.
  --preview                  Preview only (default).
  --test-stack               Use hi-france-test Docker DB defaults on localhost:5435.
  --export-dir <dir>         Directory containing ignored Ignition row exports.
  --sites-file <path>        Explicit dev_ignition.Sites export file.
  --rows-file <path>         Explicit Architecture/Create_Tag export file.
  --db-host <host>           Override DB host.
  --db-port <port>           Override DB port.
  --db-user <user>           Override DB user.
  --db-pass <password>       Override DB password.
  --db-name <name>           Override DB name.

Default export filenames:
  sites-hyperviseur-oui-*.json
  create-tag-hyperviseur-oui-*.json`);
}

function newestMatchingFile(directory, pattern) {
  if (!fs.existsSync(directory)) return null;
  return fs
    .readdirSync(directory)
    .filter((file) => pattern.test(file))
    .map((file) => {
      const absolutePath = path.join(directory, file);
      return {
        absolutePath,
        modifiedAt: fs.statSync(absolutePath).mtimeMs,
      };
    })
    .sort((a, b) => b.modifiedAt - a.modifiedAt)[0]?.absolutePath || null;
}

function resolveInputFiles(args) {
  const exportDir = path.resolve(process.cwd(), args.exportDir);
  const sitesPath =
    args.sitesPath ||
    newestMatchingFile(exportDir, /^sites-hyperviseur-oui-.*\.json$/i) ||
    newestMatchingFile(exportDir, /^sites-hyperviseur-oui-.*\.(csv|tsv)$/i);
  const rowsPath =
    args.rowsPath ||
    newestMatchingFile(exportDir, /^create-tag-hyperviseur-oui-.*\.json$/i) ||
    newestMatchingFile(
      exportDir,
      /^create-tag-hyperviseur-oui-.*\.(csv|tsv)$/i,
    );

  if (!sitesPath && !rowsPath) {
    throw new Error(
      `No France export files found in ${exportDir}. Expected sites-hyperviseur-oui-* and create-tag-hyperviseur-oui-* files.`,
    );
  }

  return {
    exportDir,
    sitesPath: sitesPath ? path.resolve(process.cwd(), sitesPath) : null,
    rowsPath: rowsPath ? path.resolve(process.cwd(), rowsPath) : null,
  };
}

function configureDatabaseEnv(args) {
  if (args.testStack) {
    Object.entries(DEFAULT_TEST_STACK_DB).forEach(([key, value]) => {
      process.env[key] = value;
    });
  }

  ["DB_HOST", "DB_PORT", "DB_USER", "DB_PASS", "DB_NAME", "DB_SSL"].forEach(
    (key) => {
      if (args[key]) process.env[key] = args[key];
    },
  );
}

async function countTable(knex, tableName) {
  const row = await knex(tableName).count({ count: "*" }).first();
  return Number(row?.count || 0);
}

async function collectDatabaseCounts(knex) {
  const [
    sites,
    postes,
    cellules,
    equipements,
    onduleurs,
    commands,
    imports,
    sitesWithArchitectureRow,
  ] = await Promise.all([
    countTable(knex, "architecture_sites"),
    countTable(knex, "architecture_postes"),
    countTable(knex, "architecture_cellules"),
    countTable(knex, "architecture_equipements"),
    countTable(knex, "architecture_onduleurs"),
    countTable(knex, "command_catalog"),
    countTable(knex, "architecture_imports"),
    knex("architecture_sites")
      .leftJoin(
        "architecture_postes",
        "architecture_sites.id",
        "architecture_postes.site_id",
      )
      .whereNotNull("architecture_postes.id")
      .countDistinct({ count: "architecture_sites.id" })
      .first(),
  ]);

  return {
    sites,
    sitesWithArchitecture: Number(sitesWithArchitectureRow?.count || 0),
    sitesWithoutArchitecture: Math.max(
      sites - Number(sitesWithArchitectureRow?.count || 0),
      0,
    ),
    postes,
    cellules,
    equipements,
    onduleurs,
    commands,
    imports,
  };
}

function expectedMinimums(sitePreview, architecturePreview) {
  const siteCount =
    sitePreview?.stats?.siteCount || architecturePreview?.stats?.siteCount || 0;
  return {
    sites: siteCount,
    sitesWithArchitecture: architecturePreview?.stats?.siteCount || 0,
    postes: architecturePreview?.stats?.posteCount || 0,
    cellules: architecturePreview?.stats?.celluleCount || 0,
    equipements: architecturePreview?.stats?.equipementCount || 0,
    onduleurs: architecturePreview?.stats?.onduleurCount || 0,
  };
}

function validateCounts(actual, expected) {
  return Object.entries(expected)
    .filter(([_key, value]) => Number(value || 0) > 0)
    .map(([key, value]) => ({
      key,
      expectedMinimum: value,
      actual: actual[key],
      ok: Number(actual[key] || 0) >= Number(value || 0),
    }));
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }

  configureDatabaseEnv(args);

  const envPath = fs.existsSync(path.join(__dirname, "../.env"))
    ? path.join(__dirname, "../.env")
    : path.join(__dirname, "../../.env");
  require("dotenv").config({ path: envPath, override: false });

  const knex = require("../db/knex");
  const {
    importCreateTagRows,
    importSiteRows,
    previewCreateTagRows,
    previewSiteRows,
    readCreateTagRowsFile,
  } = require("../lib/ignition-architecture-import");

  try {
    const files = resolveInputFiles(args);
    const siteInput = files.sitesPath
      ? readCreateTagRowsFile(files.sitesPath)
      : null;
    const rowsInput = files.rowsPath
      ? readCreateTagRowsFile(files.rowsPath)
      : null;
    const sitePreview = siteInput ? previewSiteRows(siteInput.rows) : null;
    const architecturePreview = rowsInput
      ? previewCreateTagRows(rowsInput.rows)
      : null;

    const result = {
      success: true,
      mode: args.apply ? "apply" : "preview",
      database: {
        host: process.env.DB_HOST,
        port: process.env.DB_PORT,
        name: process.env.DB_NAME,
        user: process.env.DB_USER,
      },
      files,
      previews: {
        sites: sitePreview
          ? {
              sourceFile: siteInput.absolutePath,
              stats: sitePreview.stats,
            }
          : null,
        architecture: architecturePreview
          ? {
              sourceFile: rowsInput.absolutePath,
              stats: architecturePreview.stats,
            }
          : null,
      },
      imports: null,
      counts: null,
      validations: [],
    };

    if (args.apply) {
      const siteImport = siteInput
        ? await importSiteRows(knex, siteInput.rows, {
            sourceFile: siteInput.absolutePath,
          })
        : null;
      const architectureImport = rowsInput
        ? await importCreateTagRows(knex, rowsInput.rows, {
            sourceFile: rowsInput.absolutePath,
          })
        : null;
      const counts = await collectDatabaseCounts(knex);
      const validations = validateCounts(
        counts,
        expectedMinimums(sitePreview, architecturePreview),
      );

      result.imports = {
        sites: siteImport,
        architecture: architectureImport,
      };
      result.counts = counts;
      result.validations = validations;
      result.success = validations.every((validation) => validation.ok);
    }

    console.log(JSON.stringify(result, null, 2));
    if (!result.success) process.exitCode = 1;
  } finally {
    await knex.destroy();
  }
}

main().catch((error) => {
  console.error("[France Sandbox Load]", error.message);
  process.exitCode = 1;
});
