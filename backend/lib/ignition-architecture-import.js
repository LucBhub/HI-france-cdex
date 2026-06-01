const fs = require("fs");
const path = require("path");

const ARCHITECTURE_EXPORT_PATH = path.join(
  __dirname,
  "../data/ignition-architecture-export.json",
);

const METADATA_IMPORT_SOURCE = "ignition_export_architecture_metadata";
const ROW_IMPORT_SOURCE = "ignition_create_tag_rows";

function readArchitectureExportMetadata(filePath = ARCHITECTURE_EXPORT_PATH) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function field(row, names) {
  for (const name of names) {
    if (row[name] !== undefined && row[name] !== null) return row[name];
  }
  return null;
}

function cleanString(value) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function normalizeArchitectureCode(value, fallback = "UNKNOWN") {
  const normalized = cleanString(value)
    .replace(/\s+/g, "_")
    .replace(/[^A-Za-z0-9_]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "")
    .toUpperCase();
  return normalized || fallback;
}

function normalizeSiteCode(name) {
  return cleanString(name)
    .replace(/\s+/g, "_")
    .replace(/[^A-Za-z0-9_]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "")
    .toUpperCase();
}

function parseInteger(value) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : null;
}

function parseBoolean(value) {
  if (typeof value === "boolean") return value;
  if (value === null || value === undefined || value === "") return true;
  const normalized = String(value).trim().toLowerCase();
  if (["false", "0", "no", "non"].includes(normalized)) return false;
  return true;
}

function splitCsvLine(line, delimiter) {
  const cells = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (char === '"' && inQuotes && next === '"') {
      current += '"';
      index += 1;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === delimiter && !inQuotes) {
      cells.push(current);
      current = "";
    } else {
      current += char;
    }
  }

  cells.push(current);
  return cells.map((cell) => cell.trim());
}

function detectDelimiter(headerLine) {
  const commaCount = (headerLine.match(/,/g) || []).length;
  const semicolonCount = (headerLine.match(/;/g) || []).length;
  const tabCount = (headerLine.match(/\t/g) || []).length;

  if (tabCount > commaCount && tabCount >= semicolonCount) return "\t";
  if (semicolonCount > commaCount) return ";";
  return ",";
}

function parseDelimitedText(content, options = {}) {
  const normalized = String(content || "").replace(/^\uFEFF/, "");
  const lines = normalized
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter((line) => line.trim() !== "");

  if (lines.length === 0) return [];

  const delimiter = options.delimiter || detectDelimiter(lines[0]);
  const headers = splitCsvLine(lines[0], delimiter).map((header) => header.trim());

  return lines.slice(1).map((line) => {
    const cells = splitCsvLine(line, delimiter);
    return headers.reduce((row, header, index) => {
      row[header] = cells[index] === undefined ? "" : cells[index];
      return row;
    }, {});
  });
}

function parseRowsPayload(content, filePath = "") {
  const extension = path.extname(filePath).toLowerCase();
  const normalized = String(content || "").replace(/^\uFEFF/, "");
  const text = normalized.trim();

  if (extension === ".csv" || extension === ".tsv") {
    return parseDelimitedText(content, {
      delimiter: extension === ".tsv" ? "\t" : undefined,
    });
  }

  if (extension === ".json" || text.startsWith("{") || text.startsWith("[")) {
    const payload = JSON.parse(normalized);
    const rows = Array.isArray(payload) ? payload : payload.rows;
    if (!Array.isArray(rows)) {
      throw new Error("Rows file must be an array or an object with a rows array.");
    }
    return rows;
  }

  return parseDelimitedText(content);
}

function readCreateTagRowsFile(filePath) {
  const absolutePath = path.resolve(process.cwd(), filePath);
  const content = fs.readFileSync(absolutePath, "utf8");
  return {
    absolutePath,
    rows: parseRowsPayload(content, absolutePath),
  };
}

function classifyCreateTagRow(row = {}) {
  const equipement = cleanString(field(row, ["Equipement", "equipement"]));
  const ordreCellule = field(row, [
    "Ordre_Cellule",
    "Ordre_cellule",
    "ordre_cellule",
    "ordre",
  ]);
  const nomOnduleur = cleanString(field(row, ["Nom_Onduleur", "Onduleur"]));
  const numOnduleur = field(row, [
    "Num_Onduleur",
    "numero_onduleur",
    "Num_onduleur",
  ]);

  if (nomOnduleur || numOnduleur !== null || /onduleur/i.test(equipement)) {
    return "onduleur";
  }
  if (ordreCellule !== null || /cellule/i.test(equipement)) {
    return "cellule";
  }
  if (equipement) return "equipement";
  return "unknown";
}

function normalizeCreateTagRow(row = {}) {
  const siteName = cleanString(field(row, ["Site", "site"]));
  const posteName = cleanString(field(row, ["type_poste", "Type_Poste", "Poste"]));
  const equipement = cleanString(field(row, ["Equipement", "equipement"]));
  const nomOnduleur = cleanString(field(row, ["Nom_Onduleur", "Onduleur"]));
  const numOnduleur = parseInteger(
    field(row, ["Num_Onduleur", "numero_onduleur", "Num_onduleur"]),
  );

  return {
    kind: classifyCreateTagRow(row),
    siteName,
    siteCode: normalizeSiteCode(siteName),
    posteName,
    posteCode: normalizeArchitectureCode(posteName, "POSTE"),
    agregateur: cleanString(field(row, ["Agregateur", "agregateur"])) || null,
    equipement,
    equipementCode: normalizeArchitectureCode(equipement, "EQUIPEMENT"),
    ordreCellule: parseInteger(
      field(row, ["Ordre_Cellule", "Ordre_cellule", "ordre_cellule", "ordre"]),
    ),
    nomOnduleur,
    numOnduleur,
    onduleurCode: numOnduleur
      ? normalizeArchitectureCode(`Onduleur ${numOnduleur}`)
      : normalizeArchitectureCode(nomOnduleur || equipement, "ONDULEUR"),
    ipAddress:
      cleanString(field(row, ["Adresse_Ip", "Adresse_ip", "Adresse_IP"])) || null,
    client: cleanString(field(row, ["Client", "client"])) || null,
    hyperviseur: parseBoolean(field(row, ["Hyperviseur", "hyperviseur"])),
    raw: row,
  };
}

function addSkipped(stats, index, reason, row) {
  stats.skippedRows += 1;
  stats.skipped.push({ index, reason, row });
}

function parseCreateTagRows(rows = []) {
  if (!Array.isArray(rows)) {
    throw new TypeError("Create_Tag rows must be an array.");
  }

  const parsed = {
    sites: new Map(),
    postes: new Map(),
    cellules: new Map(),
    equipements: new Map(),
    onduleurs: new Map(),
    stats: {
      totalRows: rows.length,
      skippedRows: 0,
      skipped: [],
      byKind: {
        cellule: 0,
        equipement: 0,
        onduleur: 0,
        unknown: 0,
      },
    },
  };

  rows.forEach((row, index) => {
    const normalized = normalizeCreateTagRow(row);
    if (!normalized.siteCode || !normalized.siteName) {
      addSkipped(parsed.stats, index, "missing_site", row);
      return;
    }
    if (!normalized.posteCode || !normalized.posteName) {
      addSkipped(parsed.stats, index, "missing_poste", row);
      return;
    }

    parsed.stats.byKind[normalized.kind] += 1;
    if (normalized.kind === "unknown") {
      addSkipped(parsed.stats, index, "unknown_row_type", row);
      return;
    }

    parsed.sites.set(normalized.siteCode, {
      site_code: normalized.siteCode,
      name: normalized.siteName,
      client: normalized.client,
      hyperviseur: normalized.hyperviseur,
      raw_source: {
        source: ROW_IMPORT_SOURCE,
        firstRowIndex: index,
      },
    });

    const posteKey = `${normalized.siteCode}:${normalized.posteCode}`;
    if (!parsed.postes.has(posteKey)) {
      parsed.postes.set(posteKey, {
        site_code: normalized.siteCode,
        poste_code: normalized.posteCode,
        type_poste: normalized.posteName,
        sort_order: parsed.postes.size,
        raw_source: {
          source: ROW_IMPORT_SOURCE,
          agregateur: normalized.agregateur,
          firstRowIndex: index,
        },
      });
    }

    if (normalized.kind === "cellule") {
      const celluleCode = normalizeArchitectureCode(
        normalized.equipement,
        `CELLULE_${normalized.ordreCellule || parsed.cellules.size + 1}`,
      );
      parsed.cellules.set(`${posteKey}:${celluleCode}`, {
        site_code: normalized.siteCode,
        poste_code: normalized.posteCode,
        cellule_code: celluleCode,
        type_cellule: normalized.equipement || null,
        ordre_cellule: normalized.ordreCellule,
        raw_source: {
          source: ROW_IMPORT_SOURCE,
          firstRowIndex: index,
        },
      });
    } else if (normalized.kind === "onduleur") {
      parsed.onduleurs.set(`${posteKey}:${normalized.onduleurCode}`, {
        site_code: normalized.siteCode,
        poste_code: normalized.posteCode,
        onduleur_code: normalized.onduleurCode,
        type_onduleur: normalized.nomOnduleur || normalized.equipement || null,
        numero_onduleur: normalized.numOnduleur,
        ip_address: normalized.ipAddress,
        raw_source: {
          source: ROW_IMPORT_SOURCE,
          firstRowIndex: index,
        },
      });
    } else if (normalized.kind === "equipement") {
      parsed.equipements.set(`${posteKey}:${normalized.equipementCode}`, {
        site_code: normalized.siteCode,
        poste_code: normalized.posteCode,
        equipement_code: normalized.equipementCode,
        type_equipement: normalized.equipement,
        raw_source: {
          source: ROW_IMPORT_SOURCE,
          firstRowIndex: index,
        },
      });
    }
  });

  parsed.stats.siteCount = parsed.sites.size;
  parsed.stats.posteCount = parsed.postes.size;
  parsed.stats.celluleCount = parsed.cellules.size;
  parsed.stats.equipementCount = parsed.equipements.size;
  parsed.stats.onduleurCount = parsed.onduleurs.size;

  return parsed;
}

function previewCreateTagRows(rows = []) {
  const parsed = parseCreateTagRows(rows);
  return {
    success: true,
    dryRun: true,
    stats: parsed.stats,
    samples: {
      sites: [...parsed.sites.values()].slice(0, 5),
      postes: [...parsed.postes.values()].slice(0, 5),
      cellules: [...parsed.cellules.values()].slice(0, 5),
      equipements: [...parsed.equipements.values()].slice(0, 5),
      onduleurs: [...parsed.onduleurs.values()].slice(0, 5),
    },
  };
}

function dbJson(value) {
  return JSON.stringify(value === undefined ? null : value);
}

function insertedId(insertResult) {
  if (Array.isArray(insertResult)) {
    const first = insertResult[0];
    return typeof first === "object" && first !== null ? first.id : first;
  }
  return insertResult;
}

async function insertReturningId(query, row) {
  const inserted = await query.insert(row).returning("id");
  return insertedId(inserted);
}

async function upsertBy(db, table, where, row) {
  const existing = await db(table).where(where).first();
  const now = db.fn.now();
  if (existing) {
    await db(table).where({ id: existing.id }).update({
      ...row,
      updated_at: now,
    });
    return { id: existing.id, created: false };
  }

  const id = await insertReturningId(db(table), {
    ...row,
    created_at: now,
    updated_at: now,
  });
  return { id, created: true };
}

async function recordIgnitionArchitectureMetadata(
  db,
  metadata = readArchitectureExportMetadata(),
  options = {},
) {
  const source = options.source || METADATA_IMPORT_SOURCE;
  const row = {
    source,
    status: "metadata_only",
    imported_sites: 0,
    notes:
      "Metadata extracted from Ignition export; no dev_ignition rows imported and no BDD_Ignition connection attempted.",
    metadata: dbJson({
      version: metadata.version,
      sourceExport: metadata.sourceExport,
      validationStatus: metadata.validationStatus,
      containsDataRows: metadata.containsDataRows,
      canonicalNamedQuery: metadata.canonicalNamedQuery,
      canonicalColumns: metadata.canonicalColumns,
      namedQueryCount: metadata.namedQueries?.length || 0,
      sourceTables: metadata.sourceTables || [],
    }),
  };

  const existing = await db("architecture_imports").where({ source }).first();
  if (existing) {
    await db("architecture_imports").where({ id: existing.id }).update(row);
    return { created: false, source, status: row.status };
  }

  await db("architecture_imports").insert({
    ...row,
    created_at: db.fn.now(),
  });
  return { created: true, source, status: row.status };
}

async function bootstrapIgnitionArchitectureMetadata(db) {
  return recordIgnitionArchitectureMetadata(db);
}

async function importCreateTagRows(db, rows, options = {}) {
  const metadata = options.metadata || readArchitectureExportMetadata();
  const parsed = parseCreateTagRows(rows);
  const counts = {
    sitesCreated: 0,
    postesCreated: 0,
    cellulesCreated: 0,
    equipementsCreated: 0,
    onduleursCreated: 0,
  };
  const siteIds = new Map();
  const posteIds = new Map();

  for (const site of parsed.sites.values()) {
    const result = await upsertBy(
      db,
      "architecture_sites",
      { site_code: site.site_code },
      {
        site_code: site.site_code,
        name: site.name,
        client: site.client,
        hyperviseur: site.hyperviseur,
        raw_source: dbJson({
          ...site.raw_source,
          version: metadata.version,
        }),
      },
    );
    if (result.created) counts.sitesCreated += 1;
    siteIds.set(site.site_code, result.id);
  }

  for (const poste of parsed.postes.values()) {
    const siteId = siteIds.get(poste.site_code);
    const result = await upsertBy(
      db,
      "architecture_postes",
      { site_id: siteId, poste_code: poste.poste_code },
      {
        site_id: siteId,
        poste_code: poste.poste_code,
        type_poste: poste.type_poste,
        sort_order: poste.sort_order,
        raw_source: dbJson({
          ...poste.raw_source,
          version: metadata.version,
        }),
      },
    );
    if (result.created) counts.postesCreated += 1;
    posteIds.set(`${poste.site_code}:${poste.poste_code}`, result.id);
  }

  for (const cellule of parsed.cellules.values()) {
    const posteId = posteIds.get(`${cellule.site_code}:${cellule.poste_code}`);
    const result = await upsertBy(
      db,
      "architecture_cellules",
      { poste_id: posteId, cellule_code: cellule.cellule_code },
      {
        poste_id: posteId,
        cellule_code: cellule.cellule_code,
        type_cellule: cellule.type_cellule,
        ordre_cellule: cellule.ordre_cellule,
        raw_source: dbJson({
          ...cellule.raw_source,
          version: metadata.version,
        }),
      },
    );
    if (result.created) counts.cellulesCreated += 1;
  }

  for (const equipement of parsed.equipements.values()) {
    const posteId = posteIds.get(
      `${equipement.site_code}:${equipement.poste_code}`,
    );
    const result = await upsertBy(
      db,
      "architecture_equipements",
      { poste_id: posteId, equipement_code: equipement.equipement_code },
      {
        poste_id: posteId,
        equipement_code: equipement.equipement_code,
        type_equipement: equipement.type_equipement,
        raw_source: dbJson({
          ...equipement.raw_source,
          version: metadata.version,
        }),
      },
    );
    if (result.created) counts.equipementsCreated += 1;
  }

  for (const onduleur of parsed.onduleurs.values()) {
    const posteId = posteIds.get(`${onduleur.site_code}:${onduleur.poste_code}`);
    const result = await upsertBy(
      db,
      "architecture_onduleurs",
      { poste_id: posteId, onduleur_code: onduleur.onduleur_code },
      {
        poste_id: posteId,
        onduleur_code: onduleur.onduleur_code,
        type_onduleur: onduleur.type_onduleur,
        numero_onduleur: onduleur.numero_onduleur,
        ip_address: onduleur.ip_address,
        raw_source: dbJson({
          ...onduleur.raw_source,
          version: metadata.version,
        }),
      },
    );
    if (result.created) counts.onduleursCreated += 1;
  }

  await db("architecture_imports").insert({
    source: options.source || ROW_IMPORT_SOURCE,
    status: "completed",
    imported_sites: counts.sitesCreated,
    notes:
      "Imported rows shaped like Ignition Architecture/Create_Tag output. No BDD_Ignition connection attempted.",
    metadata: dbJson({
      version: metadata.version,
      sourceFile: options.sourceFile || null,
      parsed: {
        ...parsed.stats,
        skipped: parsed.stats.skipped.slice(0, 20),
      },
      counts,
    }),
    created_at: db.fn.now(),
  });

  return {
    success: true,
    stats: parsed.stats,
    counts,
  };
}

module.exports = {
  ARCHITECTURE_EXPORT_PATH,
  METADATA_IMPORT_SOURCE,
  ROW_IMPORT_SOURCE,
  bootstrapIgnitionArchitectureMetadata,
  classifyCreateTagRow,
  importCreateTagRows,
  normalizeArchitectureCode,
  normalizeCreateTagRow,
  parseCreateTagRows,
  parseDelimitedText,
  parseRowsPayload,
  previewCreateTagRows,
  readCreateTagRowsFile,
  readArchitectureExportMetadata,
  recordIgnitionArchitectureMetadata,
};
