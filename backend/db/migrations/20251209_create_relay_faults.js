/**
 * Create relay_faults table for storing relay incidents/faults
 *
 * Features:
 * - Store fault history from Thytronic relays
 * - Track active vs resolved faults
 * - Track acknowledgment by users
 * - Auto-cleanup: max 10 faults per relay
 */

exports.up = async function (knex) {
  console.log("Creating relay_faults table...");

  await knex.schema.createTable("relay_faults", (table) => {
    table.increments("id").primary();
    table.integer("relay_id").notNullable();
    table.integer("fault_index").notNullable();
    table.integer("fault_counter");
    table.text("timestamp").notNullable();
    table.text("date");
    table.text("time");
    table.text("cause");
    table.text("fault_description");
    table.float("current_l1");
    table.float("current_l2");
    table.float("current_l3");
    table.float("voltage_u12");
    table.float("voltage_u23");
    table.float("voltage_u31");
    table.text("fault_type");
    table.boolean("is_active").defaultTo(true);
    table.boolean("acknowledged").defaultTo(false);
    table.integer("acknowledged_by");
    table.text("acknowledged_at");
    table.text("created_at").defaultTo(knex.fn.now());

    // Foreign keys
    table.foreign("relay_id").references("relays.id").onDelete("CASCADE");
    table
      .foreign("acknowledged_by")
      .references("users.id")
      .onDelete("SET NULL");

    // Indexes for performance
    table.index("relay_id");
    table.index(["relay_id", "is_active"]);
    table.index(["relay_id", "acknowledged"]);
  });

  console.log("✓ Created relay_faults table");
};

exports.down = async function (knex) {
  console.log("Dropping relay_faults table...");
  await knex.schema.dropTableIfExists("relay_faults");
  console.log("✓ Dropped relay_faults table");
};
