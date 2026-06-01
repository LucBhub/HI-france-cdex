/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function up(knex) {
  const hasPort = await knex.schema.hasColumn("relays", "port");
  const hasUnitId = await knex.schema.hasColumn("relays", "unitId");

  if (!hasPort) {
    await knex.schema.alterTable("relays", (table) => {
      table.integer("port").notNullable().defaultTo(502);
    });
  }

  if (!hasUnitId) {
    await knex.schema.alterTable("relays", (table) => {
      table.integer("unitId").notNullable().defaultTo(1);
    });
  }
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function down(knex) {
  const hasPort = await knex.schema.hasColumn("relays", "port");
  const hasUnitId = await knex.schema.hasColumn("relays", "unitId");

  if (hasPort) {
    await knex.schema.alterTable("relays", (table) => {
      table.dropColumn("port");
    });
  }

  if (hasUnitId) {
    await knex.schema.alterTable("relays", (table) => {
      table.dropColumn("unitId");
    });
  }
};
