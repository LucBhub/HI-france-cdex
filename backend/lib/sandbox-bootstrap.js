const fs = require("fs");
const path = require("path");

const CATALOG_PATH = path.join(
  __dirname,
  "../data/ignition-command-catalog.json",
);

function normalizeSiteCode(name) {
  return String(name || "")
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[^A-Za-z0-9_]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "")
    .toUpperCase();
}

function parseGps(gps) {
  if (!gps || typeof gps !== "string") {
    return { latitude: null, longitude: null };
  }
  const [lat, lon] = gps.split(",").map((part) => Number(part.trim()));
  return {
    latitude: Number.isFinite(lat) ? lat : null,
    longitude: Number.isFinite(lon) ? lon : null,
  };
}

function readCatalog() {
  return JSON.parse(fs.readFileSync(CATALOG_PATH, "utf8"));
}

async function seedCommandCatalog(knex) {
  const catalog = readCatalog();

  for (const item of catalog) {
    const row = {
      command_key: item.commandKey,
      label: item.label,
      family: item.family,
      risk_level: item.riskLevel || "medium",
      transport: item.transport || "mqtt",
      template: item.template || {},
      live_enabled: false,
      validation_status: "inferred",
      source: "ignition_export",
      metadata: item.metadata || {},
      updated_at: knex.fn.now(),
    };

    const existing = await knex("command_catalog")
      .where({ command_key: item.commandKey })
      .first();

    if (existing) {
      await knex("command_catalog")
        .where({ command_key: item.commandKey })
        .update(row);
    } else {
      await knex("command_catalog").insert({
        ...row,
        created_at: knex.fn.now(),
      });
    }
  }

  return catalog.length;
}

async function backfillArchitectureSites(knex) {
  const plants = await knex("plants").select("*");
  let importedSites = 0;

  for (const plant of plants) {
    const siteCode = normalizeSiteCode(plant.name);
    if (!siteCode) continue;

    const existing = await knex("architecture_sites")
      .where({ site_code: siteCode })
      .first();

    const { latitude, longitude } = parseGps(plant.gps);
    const row = {
      legacy_plant_id: plant.id,
      site_code: siteCode,
      name: plant.name,
      status: plant.status,
      latitude,
      longitude,
      address: plant.address,
      ce: plant.ce,
      hyperviseur: true,
      raw_source: { source: "plants", plantId: plant.id },
      updated_at: knex.fn.now(),
    };

    if (existing) {
      await knex("architecture_sites").where({ id: existing.id }).update(row);
    } else {
      await knex("architecture_sites").insert({
        ...row,
        created_at: knex.fn.now(),
      });
      importedSites += 1;
    }
  }

  const existingImport = await knex("architecture_imports")
    .where({ source: "plants_backfill" })
    .first();

  if (importedSites > 0 || !existingImport) {
    await knex("architecture_imports").insert({
      source: "plants_backfill",
      status: "completed",
      imported_sites: importedSites,
      notes:
        "Backfill initial depuis plants; aucun poste, cellule, equipement ou onduleur invente.",
      metadata: { totalPlants: plants.length },
    });
  }

  return importedSites;
}

async function bootstrapSandboxData(knex) {
  const commandCount = await seedCommandCatalog(knex);
  const siteCount = await backfillArchitectureSites(knex);
  console.log(
    `[Bootstrap] Command catalog synced (${commandCount}); architecture sites backfilled (${siteCount}).`,
  );
}

module.exports = {
  backfillArchitectureSites,
  bootstrapSandboxData,
  normalizeSiteCode,
  parseGps,
  readCatalog,
  seedCommandCatalog,
};
