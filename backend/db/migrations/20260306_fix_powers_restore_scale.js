/**
 * Fix power calculation for Thytronic XMR-A (Take 4 - Restoring scale 0.001)
 * 
 * Root Cause Analysis:
 * - We successfully restored `long_swap` decoding which fixed the byte ordering.
 * - However, relying on the `Pn / Kv` dynamic formula proved highly unreliable 
 *   across different plants (giving 3.4 MW or 22 MW depending on the Kv chosen).
 * - Testing directly against the live relays showed that `long_swap` combined with 
 *   the old explicit scale multiplier of `0.001` yields the perfect expected physical 
 *   value (e.g. 445 kW for Mottalciata).
 * 
 * Solution:
 * - Keep `long_swap` as the correct binary decoder.
 * - Re-inject `scale: 0.001` directly into the powers configuration so that 
 *   polling-service.js bypasses the Pn formula and uses the direct multiplier.
 *
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function (knex) {
    console.log("Forcing scale factor 0.001 on Thytronic powers...");

    const row = await knex("device_models")
        .where({ id: "thytronic-xmr-a" })
        .first();

    if (!row) {
        throw new Error("thytronic-xmr-a model not found");
    }

    const config =
        typeof row.config === "string" ? JSON.parse(row.config) : row.config;

    if (config.measurements && config.measurements.powers) {
        // Force scale so formula logic is ignored
        config.measurements.powers.scale = 0.001;

        // Cleanup kv/formula since they are no longer used for powers
        delete config.measurements.powers.kv;
        delete config.measurements.powers.formula;

        console.log("Updated powers config (scale 0.001 restored):", config.measurements.powers);
    }

    await knex("device_models")
        .where({ id: "thytronic-xmr-a" })
        .update({
            config: JSON.stringify(config),
        });

    console.log("✓ Fixed Thytronic powers (scale 0.001 restored).");
};

exports.down = async function (knex) {
    const row = await knex("device_models")
        .where({ id: "thytronic-xmr-a" })
        .first();

    if (!row) return;

    const config =
        typeof row.config === "string" ? JSON.parse(row.config) : row.config;

    if (config.measurements && config.measurements.powers) {
        delete config.measurements.powers.scale;
        config.measurements.powers.kv = 425609;
        config.measurements.powers.formula = "((val / 425609) * Pn) / 1000";
    }

    await knex("device_models")
        .where({ id: "thytronic-xmr-a" })
        .update({
            config: JSON.stringify(config),
        });
};
