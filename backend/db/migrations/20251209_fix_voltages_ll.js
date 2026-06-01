/**
 * Fix line-to-line voltage readings (U12, U23, U31)
 *
 * Problem: Voltages were configured incorrectly
 * Solution: Use 32-bit LONG Word Swap format at correct addresses
 *
 * Addresses (IDX - 1):
 * - U12: 408 (IDX 409)
 * - U23: 410 (IDX 411)
 * - U31: 412 (IDX 413)
 *
 * Format: 32-bit LONG with Word Swap (Little Endian word order)
 * Formula: U (V) = (raw / 112000) × Unp
 */

exports.up = async function (knex) {
  console.log("Fixing line-to-line voltages configuration...");

  // Get current thytronic config
  const row = await knex("device_models")
    .where({ id: "thytronic-xmr-a" })
    .first();

  if (!row) {
    throw new Error("thytronic-xmr-a model not found");
  }

  const config =
    typeof row.config === "string" ? JSON.parse(row.config) : row.config;

  // Update voltages configuration for line-to-line (U12, U23, U31)
  config.measurements.voltages_ll = {
    address: 408, // U12 at IDX 409 - 1
    length: 8, // 3 voltages × 2 registers + spacing = 8 registers total
    type: "long_swap", // 32-bit LONG with Word Swap
    kv: 112000,
    spacing: 2, // 2 registers between each voltage (U12@408, U23@410, U31@412)
  };

  // Keep existing phase-to-neutral voltages config
  // (will be used for UL1, UL2, UL3 if needed)

  // Update config in database
  await knex("device_models")
    .where({ id: "thytronic-xmr-a" })
    .update({
      config: JSON.stringify(config),
    });

  console.log("✓ Fixed line-to-line voltages: U12, U23, U31");
  console.log("  - Address: 408, 410, 412 (IDX 409, 411, 413 - 1)");
  console.log("  - Type: 32-bit LONG Word Swap");
  console.log("  - Formula: (raw / 112000) × Unp");
};

exports.down = async function (knex) {
  const row = await knex("device_models")
    .where({ id: "thytronic-xmr-a" })
    .first();

  if (!row) return;

  const config =
    typeof row.config === "string" ? JSON.parse(row.config) : row.config;

  // Remove voltages_ll configuration
  delete config.measurements.voltages_ll;

  await knex("device_models")
    .where({ id: "thytronic-xmr-a" })
    .update({
      config: JSON.stringify(config),
    });

  console.log("Reverted line-to-line voltages configuration");
};
