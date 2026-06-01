exports.up = async function (knex) {
  await knex.schema.createTable("audit_logs", function (table) {
    table.increments("id").primary();
    table
      .integer("user_id")
      .unsigned()
      .references("id")
      .inTable("users")
      .onDelete("SET NULL");
    table.string("username").notNullable(); // Store username copy in case user is deleted
    table.string("action").notNullable(); // e.g., 'RELAY_CONTROL', 'FAULT_ACK', 'LOGIN'
    table.string("target_type"); // e.g., 'RELAY', 'PLANT', 'SYSTEM'
    table.string("target_id"); // Can be string or int, storing as string for flexibility
    table.text("details"); // JSON string or text description
    table.string("ip_address");
    table.timestamp("created_at").defaultTo(knex.fn.now());

    // Indexes
    table.index("user_id");
    table.index("action");
    table.index("created_at");
  });
};

exports.down = async function (knex) {
  await knex.schema.dropTable("audit_logs");
};
