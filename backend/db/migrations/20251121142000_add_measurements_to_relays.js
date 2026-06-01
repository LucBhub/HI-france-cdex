/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function (knex) {
  return knex.schema.alterTable("relays", (table) => {
    table.float("voltageL1").defaultTo(0);
    table.float("voltageL2").defaultTo(0);
    table.float("voltageL3").defaultTo(0);
    table.float("currentL1").defaultTo(0);
    table.float("currentL2").defaultTo(0);
    table.float("currentL3").defaultTo(0);
    table.float("activePower").defaultTo(0);
    table.float("reactivePower").defaultTo(0);
    table.float("apparentPower").defaultTo(0);
    table.float("frequency").defaultTo(0);
    table.boolean("breakerStatus").defaultTo(false); // 0: Open, 1: Closed
    table.timestamp("lastUpdated").nullable();
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function (knex) {
  return knex.schema.alterTable("relays", (table) => {
    table.dropColumn("voltageL1");
    table.dropColumn("voltageL2");
    table.dropColumn("voltageL3");
    table.dropColumn("currentL1");
    table.dropColumn("currentL2");
    table.dropColumn("currentL3");
    table.dropColumn("activePower");
    table.dropColumn("reactivePower");
    table.dropColumn("apparentPower");
    table.dropColumn("frequency");
    table.dropColumn("breakerStatus");
    table.dropColumn("lastUpdated");
  });
};
