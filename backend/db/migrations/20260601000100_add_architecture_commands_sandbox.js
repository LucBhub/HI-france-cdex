exports.up = async function (knex) {
  await knex.schema.createTable("architecture_sites", (table) => {
    table.increments("id").primary();
    table
      .integer("legacy_plant_id")
      .unsigned()
      .references("id")
      .inTable("plants")
      .onDelete("SET NULL");
    table.string("site_code").notNullable().unique();
    table.string("name").notNullable();
    table.string("status");
    table.decimal("latitude", 10, 7);
    table.decimal("longitude", 10, 7);
    table.string("address");
    table.string("ce");
    table.string("client");
    table.boolean("hyperviseur").notNullable().defaultTo(true);
    table.jsonb("raw_source").notNullable().defaultTo("{}");
    table.timestamp("created_at").defaultTo(knex.fn.now());
    table.timestamp("updated_at").defaultTo(knex.fn.now());
  });

  await knex.schema.createTable("architecture_postes", (table) => {
    table.increments("id").primary();
    table
      .integer("site_id")
      .unsigned()
      .notNullable()
      .references("id")
      .inTable("architecture_sites")
      .onDelete("CASCADE");
    table.string("poste_code").notNullable();
    table.string("type_poste");
    table.integer("sort_order").defaultTo(0);
    table.jsonb("raw_source").notNullable().defaultTo("{}");
    table.timestamp("created_at").defaultTo(knex.fn.now());
    table.timestamp("updated_at").defaultTo(knex.fn.now());
    table.unique(["site_id", "poste_code"]);
    table.index("site_id");
  });

  await knex.schema.createTable("architecture_cellules", (table) => {
    table.increments("id").primary();
    table
      .integer("poste_id")
      .unsigned()
      .notNullable()
      .references("id")
      .inTable("architecture_postes")
      .onDelete("CASCADE");
    table.string("cellule_code").notNullable();
    table.string("type_cellule");
    table.integer("ordre_cellule");
    table.jsonb("raw_source").notNullable().defaultTo("{}");
    table.timestamp("created_at").defaultTo(knex.fn.now());
    table.timestamp("updated_at").defaultTo(knex.fn.now());
    table.unique(["poste_id", "cellule_code"]);
    table.index("poste_id");
  });

  await knex.schema.createTable("architecture_equipements", (table) => {
    table.increments("id").primary();
    table
      .integer("poste_id")
      .unsigned()
      .notNullable()
      .references("id")
      .inTable("architecture_postes")
      .onDelete("CASCADE");
    table.string("equipement_code").notNullable();
    table.string("type_equipement");
    table.jsonb("raw_source").notNullable().defaultTo("{}");
    table.timestamp("created_at").defaultTo(knex.fn.now());
    table.timestamp("updated_at").defaultTo(knex.fn.now());
    table.unique(["poste_id", "equipement_code"]);
    table.index("poste_id");
  });

  await knex.schema.createTable("architecture_onduleurs", (table) => {
    table.increments("id").primary();
    table
      .integer("poste_id")
      .unsigned()
      .notNullable()
      .references("id")
      .inTable("architecture_postes")
      .onDelete("CASCADE");
    table.string("onduleur_code").notNullable();
    table.string("type_onduleur");
    table.integer("numero_onduleur");
    table.string("ip_address");
    table.jsonb("raw_source").notNullable().defaultTo("{}");
    table.timestamp("created_at").defaultTo(knex.fn.now());
    table.timestamp("updated_at").defaultTo(knex.fn.now());
    table.unique(["poste_id", "onduleur_code"]);
    table.index("poste_id");
  });

  await knex.schema.createTable("architecture_imports", (table) => {
    table.increments("id").primary();
    table.string("source").notNullable();
    table.string("status").notNullable().defaultTo("pending");
    table.integer("imported_sites").notNullable().defaultTo(0);
    table.text("notes");
    table.jsonb("metadata").notNullable().defaultTo("{}");
    table.timestamp("created_at").defaultTo(knex.fn.now());
  });

  await knex.schema.createTable("command_catalog", (table) => {
    table.increments("id").primary();
    table.string("command_key").notNullable().unique();
    table.string("label").notNullable();
    table.string("family").notNullable();
    table.string("risk_level").notNullable().defaultTo("medium");
    table.string("transport").notNullable().defaultTo("mqtt");
    table.jsonb("template").notNullable().defaultTo("{}");
    table.boolean("live_enabled").notNullable().defaultTo(false);
    table.string("validation_status").notNullable().defaultTo("inferred");
    table.string("source").notNullable().defaultTo("ignition_export");
    table.jsonb("metadata").notNullable().defaultTo("{}");
    table.timestamp("created_at").defaultTo(knex.fn.now());
    table.timestamp("updated_at").defaultTo(knex.fn.now());
  });

  await knex.schema.createTable("command_runs", (table) => {
    table.increments("id").primary();
    table.string("command_key").notNullable();
    table.string("mode").notNullable().defaultTo("dry_run");
    table.string("status").notNullable().defaultTo("planned");
    table.boolean("dry_run").notNullable().defaultTo(true);
    table.integer("user_id").unsigned().references("id").inTable("users").onDelete("SET NULL");
    table.string("requested_by").notNullable().defaultTo("unknown");
    table.jsonb("target").notNullable().defaultTo("{}");
    table.jsonb("params").notNullable().defaultTo("{}");
    table.jsonb("planned_events").notNullable().defaultTo("[]");
    table.text("error");
    table.timestamp("created_at").defaultTo(knex.fn.now());
    table.timestamp("updated_at").defaultTo(knex.fn.now());
    table.index("command_key");
    table.index("status");
    table.index("created_at");
  });

  await knex.schema.createTable("sandbox_mqtt_events", (table) => {
    table.increments("id").primary();
    table
      .integer("command_run_id")
      .unsigned()
      .references("id")
      .inTable("command_runs")
      .onDelete("SET NULL");
    table.string("direction").notNullable();
    table.string("event_type").notNullable();
    table.string("topic").notNullable();
    table.text("payload");
    table.integer("qos").notNullable().defaultTo(0);
    table.string("status").notNullable().defaultTo("planned");
    table.jsonb("metadata").notNullable().defaultTo("{}");
    table.timestamp("created_at").defaultTo(knex.fn.now());
    table.index("command_run_id");
    table.index("topic");
    table.index("created_at");
  });
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists("sandbox_mqtt_events");
  await knex.schema.dropTableIfExists("command_runs");
  await knex.schema.dropTableIfExists("command_catalog");
  await knex.schema.dropTableIfExists("architecture_imports");
  await knex.schema.dropTableIfExists("architecture_onduleurs");
  await knex.schema.dropTableIfExists("architecture_equipements");
  await knex.schema.dropTableIfExists("architecture_cellules");
  await knex.schema.dropTableIfExists("architecture_postes");
  await knex.schema.dropTableIfExists("architecture_sites");
};
