const {
  classifyCreateTagRow,
  importCreateTagRows,
  parseCreateTagRows,
  readArchitectureExportMetadata,
  recordIgnitionArchitectureMetadata,
} = require("../../lib/ignition-architecture-import");

function matches(row, criteria) {
  return Object.entries(criteria || {}).every(([key, value]) => row[key] === value);
}

function makeDb(initial = {}) {
  const data = {
    architecture_sites: [],
    architecture_postes: [],
    architecture_cellules: [],
    architecture_equipements: [],
    architecture_onduleurs: [],
    architecture_imports: [],
    ...initial,
  };
  const nextIds = {};

  function db(table) {
    const state = { criteria: null };
    const selectedRows = () =>
      data[table].filter((row) => matches(row, state.criteria));
    const chain = {
      where(criteria) {
        state.criteria = criteria;
        return chain;
      },
      async first() {
        return selectedRows()[0];
      },
      insert(row) {
        nextIds[table] = nextIds[table] || data[table].length + 1;
        const id = nextIds[table]++;
        data[table].push({ id, ...row });
        const result = {
          returning: async () => [id],
          then(resolve, reject) {
            return Promise.resolve([id]).then(resolve, reject);
          },
        };
        return result;
      },
      async update(row) {
        const rows = selectedRows();
        rows.forEach((item) => Object.assign(item, row));
        return rows.length;
      },
    };
    return chain;
  }

  db.data = data;
  db.fn = { now: jest.fn(() => "now") };
  return db;
}

const createTagRows = [
  {
    Site: "Plan Auron",
    type_poste: "PTR 1",
    Agregateur: "Agregateur A",
    Equipement: "Cellule Arrivee",
    Ordre_Cellule: 1,
    Client: "MQTT",
    Hyperviseur: true,
  },
  {
    Site: "Plan Auron",
    type_poste: "PTR 1",
    Agregateur: "Agregateur A",
    Equipement: "Chargeur Batterie",
    Client: "MQTT",
    Hyperviseur: true,
  },
  {
    Site: "Plan Auron",
    type_poste: "PTR 1",
    Agregateur: "Agregateur A",
    Equipement: "Onduleur",
    Nom_Onduleur: "Huawei SUN2000",
    Num_Onduleur: 3,
    Adresse_Ip: "10.0.0.3",
    Client: "MQTT",
    Hyperviseur: true,
  },
];

describe("ignition architecture import", () => {
  test("reads versioned export metadata without data rows", () => {
    const metadata = readArchitectureExportMetadata();

    expect(metadata.version).toBe("2026-06-01_1028");
    expect(metadata.containsDataRows).toBe(false);
    expect(metadata.canonicalNamedQuery).toBe("Architecture/Create_Tag");
  });

  test("classifies Create_Tag rows safely", () => {
    expect(classifyCreateTagRow({ Equipement: "Chargeur Batterie" })).toBe(
      "equipement",
    );
    expect(
      classifyCreateTagRow({ Equipement: "Cellule Arrivee", Ordre_Cellule: 1 }),
    ).toBe("cellule");
    expect(classifyCreateTagRow({ Nom_Onduleur: "Huawei", Num_Onduleur: 2 })).toBe(
      "onduleur",
    );
    expect(classifyCreateTagRow({})).toBe("unknown");
  });

  test("parses Create_Tag rows into architecture entities", () => {
    const parsed = parseCreateTagRows(createTagRows);

    expect(parsed.stats).toMatchObject({
      totalRows: 3,
      siteCount: 1,
      posteCount: 1,
      celluleCount: 1,
      equipementCount: 1,
      onduleurCount: 1,
    });
    expect([...parsed.sites.values()][0].site_code).toBe("PLAN_AURON");
  });

  test("skips unknown row types without creating site or poste entities", () => {
    const parsed = parseCreateTagRows([{ Site: "Plan Auron", type_poste: "PTR 1" }]);

    expect(parsed.stats.skippedRows).toBe(1);
    expect(parsed.sites.size).toBe(0);
    expect(parsed.postes.size).toBe(0);
  });

  test("records metadata import idempotently without creating architecture rows", async () => {
    const db = makeDb();

    await recordIgnitionArchitectureMetadata(db);
    await recordIgnitionArchitectureMetadata(db);

    expect(db.data.architecture_imports).toHaveLength(1);
    expect(db.data.architecture_imports[0]).toMatchObject({
      source: "ignition_export_architecture_metadata",
      status: "metadata_only",
      imported_sites: 0,
    });
    expect(db.data.architecture_sites).toHaveLength(0);
    expect(db.data.architecture_postes).toHaveLength(0);
  });

  test("imports supplied Create_Tag rows without duplicating architecture entities", async () => {
    const db = makeDb();

    await importCreateTagRows(db, createTagRows);
    await importCreateTagRows(db, createTagRows);

    expect(db.data.architecture_sites).toHaveLength(1);
    expect(db.data.architecture_postes).toHaveLength(1);
    expect(db.data.architecture_cellules).toHaveLength(1);
    expect(db.data.architecture_equipements).toHaveLength(1);
    expect(db.data.architecture_onduleurs).toHaveLength(1);
    expect(db.data.architecture_imports).toHaveLength(2);
    expect(db.data.architecture_onduleurs[0]).toMatchObject({
      onduleur_code: "ONDULEUR_3",
      numero_onduleur: 3,
      ip_address: "10.0.0.3",
    });
  });
});
