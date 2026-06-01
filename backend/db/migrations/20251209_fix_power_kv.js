/**
 * Fix power calculation Kv
 *
 * Problem: Power Kv was set to 3,000,000 (from manual) but actual Kv is ~425,609
 * Solution: Update Kv to correct value based on real measurements
 *
 * Verification:
 * - Raw power: -4778
 * - Expected: -245 kW
 * - Pn = √3 × 20000V × 630A = 21,823,840 VA
 * - Formula: P = (raw / Kv) × Pn / 1000
 * - Kv = (raw × Pn) / (P × 1000) = 425,609
 */

exports.up = async function (knex) {
  console.log("Fixing power calculation Kv...");

  // Get current thytronic config
  const row = await knex("device_models")
    .where({ id: "thytronic-xmr-a" })
    .first();

  if (!row) {
    throw new Error("thytronic-xmr-a model not found");
  }

  const config =
    typeof row.config === "string" ? JSON.parse(row.config) : row.config;

  // Update power Kv
  if (config.measurements && config.measurements.powers) {
    config.measurements.powers.kv = 425609;
    config.measurements.powers.formula = "((val / 425609) * Pn) / 1000";

    console.log("Updated power Kv from 3000000 to 425609");
  }

  // Update config in database
  await knex("device_models")
    .where({ id: "thytronic-xmr-a" })
    .update({
      config: JSON.stringify(config),
    });

  console.log("✓ Fixed power Kv");
  console.log("  - Old Kv: 3,000,000");
  console.log("  - New Kv: 425,609");
  console.log("  - Formula: P (kW) = (raw / 425609) × Pn / 1000");
};

exports.down = async function (knex) {
  const row = await knex("device_models")
    .where({ id: "thytronic-xmr-a" })
    .first();

  if (!row) return;

  const config =
    typeof row.config === "string" ? JSON.parse(row.config) : row.config;

  // Revert to old Kv
  if (config.measurements && config.measurements.powers) {
    config.measurements.powers.kv = 3000000;
    config.measurements.powers.formula = "((val / 3000000) * Pn) / 1000";
  }

  await knex("device_models")
    .where({ id: "thytronic-xmr-a" })
    .update({
      config: JSON.stringify(config),
    });

  console.log("Reverted power Kv to 3,000,000");
};
