/**
 * Fix power calculation for Thytronic XMR-A (Take 3 - Final Kv)
 * 
 * Root Cause Analysis:
 * - We successfully restored `long_swap` decoding which fixed the byte ordering.
 * - However, restoring `Kv: 3000000` from the manual was a mistake. 
 * - An earlier migration (20251209_fix_power_kv) proved empirically that the real Kv
 *   on the installed relays is exactly 425609.
 * - Changing the Kv from 425609 to 3000000 incorrectly multiplies the displayed power
 *   by approximately 7x ! (e.g. 3.4 MW instead of 468 kW).
 * 
 * Solution:
 * - Keep `long_swap` as the correct binary decoder.
 * - Restore `Kv` to `425609`.
 *
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function (knex) {
    console.log("Applying final empirical Kv (425609) to Thytronic powers...");

    const row = await knex("device_models")
        .where({ id: "thytronic-xmr-a" })
        .first();

    if (!row) {
        throw new Error("thytronic-xmr-a model not found");
    }

    const config =
        typeof row.config === "string" ? JSON.parse(row.config) : row.config;

    if (config.measurements && config.measurements.powers) {
        // Keep long_swap, change Kv to the proven empirical value
        config.measurements.powers.kv = 425609;

        // Explicitly enforce scale deletion (insurance)
        delete config.measurements.powers.scale;

        console.log("Updated powers config:", config.measurements.powers);
    }

    await knex("device_models")
        .where({ id: "thytronic-xmr-a" })
        .update({
            config: JSON.stringify(config),
        });

    console.log("✓ Fixed Thytronic powers (Kv 425609 restored).");
};

exports.down = async function (knex) {
    const row = await knex("device_models")
        .where({ id: "thytronic-xmr-a" })
        .first();

    if (!row) return;

    const config =
        typeof row.config === "string" ? JSON.parse(row.config) : row.config;

    if (config.measurements && config.measurements.powers) {
        config.measurements.powers.kv = 3000000;
    }

    await knex("device_models")
        .where({ id: "thytronic-xmr-a" })
        .update({
            config: JSON.stringify(config),
        });
};
