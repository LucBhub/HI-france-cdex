/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function (knex) {
  // 1. Create device_models table
  await knex.schema.createTable("device_models", (table) => {
    table.string("id").primary(); // e.g. 'thytronic-xmr-a'
    table.string("name").notNullable();
    table.json("config").notNullable(); // The register map and driver config
    table.timestamp("created_at").defaultTo(knex.fn.now());
  });

  // 2. Add modelId to relays table
  await knex.schema.table("relays", (table) => {
    table
      .string("modelId")
      .references("id")
      .inTable("device_models")
      .onDelete("SET NULL") // If model is deleted, keep relay but maybe warn? Or RESTRICT.
      .defaultTo("thytronic-xmr-a"); // Default for existing relays
  });

  // 3. Seed the default Thytronic XMR-A model
  const thytronicConfig = {
    // Nominal Values
    // According to Modbus tutorial: Real value = Decoded value / Kv
    nominal: {
      inp: { address: 77, type: "ulong", length: 2, kv: 100 }, // Try with kv=100 first
      unp: { address: 85, type: "ulong", length: 2, kv: 100 }, // Try with kv=100 first
      // Pn calculation is hardcoded/standard: sqrt(3) * (Unp/kv) * (Inp/kv)
    },
    // Measurements
    measurements: {
      currents: { address: 390, length: 14, scale: 0.001 }, // L1, L2, L3 (Offsets 0, 4, 8)
      voltages: { address: 390, offset: 16, length: 12, scale: 0.001 }, // L1, L2, L3 (Offsets 16, 20, 24) - Note: Same block as currents in code
      frequency: { address: 442, length: 2, scale: 0.001 },
      powers: {
        address: 478,
        length: 6,
        scale: 0.001,
        formula: "((val / 3000000) * Pn) / 1000",
      }, // Active, Reactive, Apparent
    },
    // Status
    breakerStatus: {
      discrete: 317,
      holding: 317,
    },
    // Control Coils (IDX - 1)
    control: {
      couple: 15, // IDX 16
      decouple: 14, // IDX 15
    },
  };

  await knex("device_models").insert({
    id: "thytronic-xmr-a",
    name: "Thytronic XMR-A",
    config: JSON.stringify(thytronicConfig),
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function (knex) {
  await knex.schema.table("relays", (table) => {
    table.dropColumn("modelId");
  });
  await knex.schema.dropTable("device_models");
};
