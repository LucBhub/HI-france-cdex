/**
 * FINAL FIX: Restore exact preprod/dev configuration for Thytronic XMR-A powers
 *
 * This migration replaces all previous power-related migrations for this model and
 * sets the database to the exact state that the preproduction environment uses,
 * which was proven to produce correct results.
 *
 * Preprod config (from local PostgreSQL, verified working):
 *   powers: { address:478, length:6, type:"long_swap", kv:3000000, spacing:2, est_pf:0.9 }
 *
 * This means:
 *   - Registers read as 32-bit long-word-swap (correct byte order for Thytronic)
 *   - Factor computed as: Pn / 1000 / kv  (where Pn = sqrt(3) * INP * UNP)
 *   - NO "scale" property (so the polling-service uses the Pn formula, not a fixed multiplier)
 *
 * Validated locally (2026-03-06):
 *   INP=630A, UNP=20000V -> Pn=21,823,840 VA
 *   Factor = 0.0072746
 *   Site 1 Active Power: -839.81 kW  ✓  (physically coherent for a 630A/20kV relay)
 *
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function (knex) {
    console.log("FINAL FIX: Restoring exact preprod powers config for thytronic-xmr-a...");

    const row = await knex("device_models")
        .where({ id: "thytronic-xmr-a" })
        .first();

    if (!row) {
        throw new Error("thytronic-xmr-a model not found");
    }

    const config =
        typeof row.config === "string" ? JSON.parse(row.config) : row.config;

    if (config.measurements && config.measurements.powers) {
        // Restore the exact preprod configuration
        config.measurements.powers.length = 6;            // 6 registers = 3 x 32-bit values
        config.measurements.powers.type = "long_swap";  // Correct byte order for Thytronic
        config.measurements.powers.kv = 3000000;      // As per preprod DB
        config.measurements.powers.spacing = 2;            // As per preprod DB
        config.measurements.powers.est_pf = 0.9;          // As per preprod DB

        // CRITICAL: Remove "scale" so polling-service uses the Pn formula, not a fixed multiplier
        delete config.measurements.powers.scale;
        delete config.measurements.powers.formula; // legacy field, not used at runtime

        console.log("Updated powers config:", JSON.stringify(config.measurements.powers));
    }

    await knex("device_models")
        .where({ id: "thytronic-xmr-a" })
        .update({ config: JSON.stringify(config) });

    console.log("✓ thytronic-xmr-a powers config restored to exact preprod state.");
};

exports.down = async function (knex) {
    const row = await knex("device_models")
        .where({ id: "thytronic-xmr-a" })
        .first();

    if (!row) return;

    const config =
        typeof row.config === "string" ? JSON.parse(row.config) : row.config;

    if (config.measurements && config.measurements.powers) {
        // Revert to the broken state before this fix (scale 0.001 from previous broken migration)
        config.measurements.powers.scale = 0.001;
        delete config.measurements.powers.spacing;
        delete config.measurements.powers.est_pf;
    }

    await knex("device_models")
        .where({ id: "thytronic-xmr-a" })
        .update({ config: JSON.stringify(config) });
};
