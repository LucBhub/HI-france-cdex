/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function (knex) {
  const row = await knex("device_models")
    .where({ id: "thytronic-xmr-a" })
    .first();
  if (!row) return;

  const config =
    typeof row.config === "string" ? JSON.parse(row.config) : row.config;

  // Fix currents: They are UWORD (16-bit), not LONG (32-bit)
  // Read L1, L2, L3 as separate 16-bit values
  config.measurements.currents = {
    address: 390, // IDX 391 - 1 (L1)
    length: 6, // 3 currents × 2 registers each (skip between)
    scale: 0.001,
    type: "uword", // 16-bit unsigned
    spacing: 2, // Skip 1 register between each current (391, 393, 395)
  };

  await knex("device_models")
    .where({ id: "thytronic-xmr-a" })
    .update({
      config: JSON.stringify(config),
    });

  console.log("✓ Fixed currents: UWORD 16-bit with spacing");
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function (knex) {
  const row = await knex("device_models")
    .where({ id: "thytronic-xmr-a" })
    .first();
  if (!row) return;

  const config =
    typeof row.config === "string" ? JSON.parse(row.config) : row.config;

  // Revert to old configuration
  config.measurements.currents = {
    address: 391,
    length: 14,
    scale: 0.001,
  };

  await knex("device_models")
    .where({ id: "thytronic-xmr-a" })
    .update({
      config: JSON.stringify(config),
    });
};
