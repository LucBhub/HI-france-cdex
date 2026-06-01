/**
 * Add breakerStatus and lastUpdated columns to relays table
 */
exports.up = async function (knex) {
  const hasBreakerStatus = await knex.schema.hasColumn(
    "relays",
    "breakerStatus",
  );
  const hasLastUpdated = await knex.schema.hasColumn("relays", "lastUpdated");

  await knex.schema.table("relays", function (table) {
    if (!hasBreakerStatus) {
      table.boolean("breakerStatus").defaultTo(false); // 0 or 1, boolean compatible
    }
    if (!hasLastUpdated) {
      table.timestamp("lastUpdated").defaultTo(knex.fn.now());
    }
  });
};

exports.down = async function (knex) {
  await knex.schema.table("relays", function (table) {
    table.dropColumn("breakerStatus");
    table.dropColumn("lastUpdated");
  });
};
