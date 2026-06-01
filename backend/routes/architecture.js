const express = require("express");
const knex = require("../db/knex");
const authMiddleware = require("../middleware/auth");

const router = express.Router();
const allowedRoles = ["member", "admin", "superadmin"];

function toNumber(value) {
  return Number(value || 0);
}

async function countTable(tableName) {
  const row = await knex(tableName).count({ count: "*" }).first();
  return toNumber(row?.count);
}

router.get("/summary", authMiddleware(allowedRoles), async (req, res) => {
  try {
    const [
      siteCount,
      posteCount,
      celluleCount,
      equipementCount,
      onduleurCount,
      commandCount,
      sitesWithArchitectureRow,
      imports,
      sitesByClient,
    ] = await Promise.all([
      countTable("architecture_sites"),
      countTable("architecture_postes"),
      countTable("architecture_cellules"),
      countTable("architecture_equipements"),
      countTable("architecture_onduleurs"),
      countTable("command_catalog"),
      knex("architecture_sites")
        .leftJoin(
          "architecture_postes",
          "architecture_sites.id",
          "architecture_postes.site_id",
        )
        .whereNotNull("architecture_postes.id")
        .countDistinct({ count: "architecture_sites.id" })
        .first(),
      knex("architecture_imports").orderBy("created_at", "desc").limit(5),
      knex("architecture_sites")
        .select("client")
        .count({ count: "*" })
        .groupBy("client")
        .orderBy("client", "asc"),
    ]);

    const sitesWithArchitecture = toNumber(sitesWithArchitectureRow?.count);
    res.json({
      success: true,
      summary: {
        sites: siteCount,
        sitesWithArchitecture,
        sitesWithoutArchitecture: Math.max(siteCount - sitesWithArchitecture, 0),
        postes: posteCount,
        cellules: celluleCount,
        equipements: equipementCount,
        onduleurs: onduleurCount,
        commands: commandCount,
        imports,
        sitesByClient: sitesByClient.map((row) => ({
          client: row.client || "unknown",
          count: toNumber(row.count),
        })),
      },
    });
  } catch (error) {
    console.error("[Architecture] Failed to load summary:", error);
    res.status(500).json({
      success: false,
      message: "Failed to load architecture summary.",
    });
  }
});

router.get("/imports", authMiddleware(allowedRoles), async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const imports = await knex("architecture_imports")
      .orderBy("created_at", "desc")
      .limit(limit);

    res.json({ success: true, imports });
  } catch (error) {
    console.error("[Architecture] Failed to list imports:", error);
    res.status(500).json({
      success: false,
      message: "Failed to list architecture imports.",
    });
  }
});

router.get("/sites", authMiddleware(allowedRoles), async (req, res) => {
  try {
    const sites = await knex("architecture_sites")
      .select(
        "architecture_sites.*",
        knex.raw("COUNT(DISTINCT architecture_postes.id)::int AS poste_count"),
        knex.raw("COUNT(DISTINCT architecture_cellules.id)::int AS cellule_count"),
        knex.raw(
          "COUNT(DISTINCT architecture_equipements.id)::int AS equipement_count",
        ),
        knex.raw("COUNT(DISTINCT architecture_onduleurs.id)::int AS onduleur_count"),
        knex.raw("(COUNT(DISTINCT architecture_postes.id) > 0) AS has_architecture"),
      )
      .leftJoin(
        "architecture_postes",
        "architecture_sites.id",
        "architecture_postes.site_id",
      )
      .leftJoin(
        "architecture_cellules",
        "architecture_postes.id",
        "architecture_cellules.poste_id",
      )
      .leftJoin(
        "architecture_equipements",
        "architecture_postes.id",
        "architecture_equipements.poste_id",
      )
      .leftJoin(
        "architecture_onduleurs",
        "architecture_postes.id",
        "architecture_onduleurs.poste_id",
      )
      .groupBy("architecture_sites.id")
      .orderBy("architecture_sites.name", "asc");

    res.json({ success: true, sites });
  } catch (error) {
    console.error("[Architecture] Failed to list sites:", error);
    res.status(500).json({
      success: false,
      message: "Failed to list architecture sites.",
    });
  }
});

router.get("/sites/:id/tree", authMiddleware(allowedRoles), async (req, res) => {
  try {
    const siteQuery = knex("architecture_sites");
    const parsedId = Number(req.params.id);
    if (Number.isInteger(parsedId)) {
      siteQuery.where({ id: parsedId });
    } else {
      siteQuery.where({ site_code: String(req.params.id).toUpperCase() });
    }

    const site = await siteQuery.first();
    if (!site) {
      return res.status(404).json({
        success: false,
        message: "Architecture site not found.",
      });
    }

    const postes = await knex("architecture_postes")
      .where({ site_id: site.id })
      .orderBy("sort_order", "asc")
      .orderBy("poste_code", "asc");
    const posteIds = postes.map((poste) => poste.id);

    const [cellules, equipements, onduleurs] = posteIds.length
      ? await Promise.all([
          knex("architecture_cellules")
            .whereIn("poste_id", posteIds)
            .orderBy("ordre_cellule", "asc")
            .orderBy("cellule_code", "asc"),
          knex("architecture_equipements")
            .whereIn("poste_id", posteIds)
            .orderBy("equipement_code", "asc"),
          knex("architecture_onduleurs")
            .whereIn("poste_id", posteIds)
            .orderBy("numero_onduleur", "asc")
            .orderBy("onduleur_code", "asc"),
        ])
      : [[], [], []];

    const tree = {
      ...site,
      postes: postes.map((poste) => ({
        ...poste,
        cellules: cellules.filter((item) => item.poste_id === poste.id),
        equipements: equipements.filter((item) => item.poste_id === poste.id),
        onduleurs: onduleurs.filter((item) => item.poste_id === poste.id),
      })),
    };

    res.json({ success: true, site: tree });
  } catch (error) {
    console.error("[Architecture] Failed to load site tree:", error);
    res.status(500).json({
      success: false,
      message: "Failed to load architecture site tree.",
    });
  }
});

module.exports = router;
