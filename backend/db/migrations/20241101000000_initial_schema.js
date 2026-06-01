/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function (knex) {
  return knex.schema
    .createTable("plants", (table) => {
      table.increments("id").primary();
      table.string("name").notNullable();
      table.string("status");
      table.float("powerKwc");
      table.string("gps");
      table.string("address");
      table.string("ce");
      table.string("modemLogin");
      table.string("modemPassword");
      table.string("acrMerignac");
      table.string("deliveryStation");
      table.string("departureStation");
      table.string("sourceStation");
      table.string("card1");
      table.float("powerOutput").defaultTo(0);
      table.float("totalEnergy").defaultTo(0);
      table.float("frequency").defaultTo(0);
      table.float("currentL1").defaultTo(0);
      table.float("currentL2").defaultTo(0);
      table.float("currentL3").defaultTo(0);
      table.float("voltageU12").defaultTo(0);
      table.float("voltageU23").defaultTo(0);
      table.float("voltageU31").defaultTo(0);
    })
    .createTable("relays", (table) => {
      table.increments("id").primary();
      table
        .integer("plantId")
        .unsigned()
        .references("id")
        .inTable("plants")
        .onDelete("CASCADE");
      table.string("ipAddress").notNullable();
    })
    .createTable("alarms", (table) => {
      table.increments("id").primary();
      table.string("plantName");
      table
        .integer("plantId")
        .unsigned()
        .references("id")
        .inTable("plants")
        .onDelete("CASCADE");
      table.string("message");
      table.string("priority");
      table.string("status");
      table.string("timestamp");
      table.string("label");
      table.string("name");
    })
    .createTable("users", (table) => {
      table.increments("id").primary();
      table.string("username").unique().notNullable();
      table.string("email").unique().notNullable();
      table.string("password").notNullable();
      table.string("role").notNullable().defaultTo("member"); // roles: member, admin, superadmin
    })
    .createTable("password_resets", (table) => {
      table.increments("id").primary();
      table.string("email").notNullable();
      table.string("token").notNullable().unique();
      table.timestamp("expires_at").notNullable();
    });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function (knex) {
  return knex.schema
    .dropTableIfExists("password_resets")
    .dropTableIfExists("users")
    .dropTableIfExists("alarms")
    .dropTableIfExists("relays")
    .dropTableIfExists("plants");
};
