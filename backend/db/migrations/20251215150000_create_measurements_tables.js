/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function (knex) {
  return (
    knex.schema
      // 1. Raw Measurements (10-min interval, retained for 30 days)
      .createTable("measurements", function (table) {
        table.increments("id").primary();
        table
          .integer("plant_id")
          .unsigned()
          .notNullable()
          .references("id")
          .inTable("plants")
          .onDelete("CASCADE");
        table
          .integer("relay_id")
          .unsigned()
          .references("id")
          .inTable("relays")
          .onDelete("CASCADE"); // Optional, mainly for debugging
        table.dateTime("timestamp").notNullable().index(); // Indexed for fast range queries

        // Measurements
        table.float("power_kw").defaultTo(0);
        table.float("voltage_v").defaultTo(0); // Average of L1/L2/L3 or just L1 depending on logic
        table.float("current_a").defaultTo(0);
        table.float("frequency_hz").defaultTo(0);

        table.timestamps(true, true);
      })

      // 2. Hourly Aggregated Measurements (Retained for 1 year)
      .createTable("measurements_hourly", function (table) {
        table.increments("id").primary();
        table
          .integer("plant_id")
          .unsigned()
          .notNullable()
          .references("id")
          .inTable("plants")
          .onDelete("CASCADE");
        table.dateTime("timestamp").notNullable().index(); // Represents the start of the hour

        // Aggregates
        table.float("avg_power_kw").defaultTo(0);
        table.float("max_power_kw").defaultTo(0);
        table.float("total_energy_kwh").defaultTo(0); // If we can calculate it (power * time)

        table.float("avg_voltage_v").defaultTo(0);
        table.float("max_voltage_v").defaultTo(0);
        table.float("min_voltage_v").defaultTo(0);

        table.float("avg_current_a").defaultTo(0);
        table.float("max_current_a").defaultTo(0);

        table.timestamps(true, true);
      })

      // 3. Hourly Irradiation (From Open-Meteo, retained indefinitely or 1y+)
      .createTable("irradiation_hourly", function (table) {
        table.increments("id").primary();
        table
          .integer("plant_id")
          .unsigned()
          .notNullable()
          .references("id")
          .inTable("plants")
          .onDelete("CASCADE");
        table.dateTime("timestamp").notNullable().index();

        // Data from Open-Meteo
        table.float("irradiation_wh_m2").defaultTo(0); // Wh/m² (accumulated over the hour)
        table.float("temperature_c").defaultTo(0); // Ambient temperature

        // Unique constraint to avoid duplicates
        table.unique(["plant_id", "timestamp"]);

        table.timestamps(true, true);
      })
  );
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function (knex) {
  return knex.schema
    .dropTableIfExists("irradiation_hourly")
    .dropTableIfExists("measurements_hourly")
    .dropTableIfExists("measurements");
};
