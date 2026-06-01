/**
 * Fix power addresses - use correct address 478 (IDX 479 - 1)
 * and restore Kv to manual value 3,000,000
 *
 * Problem: Was using address 479 instead of 478
 * Solution: IDX 479 → address 478 (IDX - 1 rule)
 *
 * Verification with relay :4030:
 * - Raw = -2140
 * - Pn = 21.82 MVA
 * - P = (-2140 / 3,000,000) × 21.82 = -15.56 kW ✓
 */

exports.up = async function (knex) {
  console.log("Fixing power addresses and Kv...");

  const row = await knex("device_models")
    .where({ id: "thytronic-xmr-a" })
    .first();

  if (!row) {
    throw new Error("thytronic-xmr-a model not found");
  }

  const config =
    typeof row.config === "string" ? JSON.parse(row.config) : row.config;

  // Update power configuration
  if (config.measurements && config.measurements.powers) {
    config.measurements.powers.address = 478; // IDX 479 - 1
    config.measurements.powers.kv = 3000000; // Restore manual value
    config.measurements.powers.formula = "((val / 3000000) * Pn) / 1000";

    console.log("Updated power configuration:");
    console.log("  - Address: 479 → 478 (IDX 479 - 1)");
    console.log("  - Kv: 425,609 → 3,000,000 (manual value)");
  }

  await knex("device_models")
    .where({ id: "thytronic-xmr-a" })
    .update({
      config: JSON.stringify(config),
    });

  console.log("✓ Fixed power addresses and Kv");
};

exports.down = async function (knex) {
  const row = await knex("device_models")
    .where({ id: "thytronic-xmr-a" })
    .first();

  if (!row) return;

  const config =
    typeof row.config === "string" ? JSON.parse(row.config) : row.config;

  if (config.measurements && config.measurements.powers) {
    config.measurements.powers.address = 479;
    config.measurements.powers.kv = 425609;
  }

  await knex("device_models")
    .where({ id: "thytronic-xmr-a" })
    .update({
      config: JSON.stringify(config),
    });

  console.log("Reverted power configuration");
};
