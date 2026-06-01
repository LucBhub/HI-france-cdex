/**
 * Fix power calculation for Thytronic XMR-A
 * 
 * Root Cause Analysis:
 * - Active power values were combining two 16-bit registers (Active + Reactive)
 *   into a single 32-bit value, causing aberrant data (e.g. 2102067204 kW).
 * - "scale: 0.001" was overriding the Pn/Kv calculation in polling-service.js.
 * 
 * Solution:
 * - Set type to "int16" and length to 3 (instead of 6).
 * - Remove the "scale" field to let polling-service.js use the defined Pn/Kv logic.
 * - Restore Kv to the manual's theoretical 3,000,000.
 *
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function (knex) {
    console.log("Fixing Thytronic powers configuration to 16-bit...");

    const row = await knex("device_models")
        .where({ id: "thytronic-xmr-a" })
        .first();

    if (!row) {
        throw new Error("thytronic-xmr-a model not found");
    }

    const config =
        typeof row.config === "string" ? JSON.parse(row.config) : row.config;

    if (config.measurements && config.measurements.powers) {
        config.measurements.powers.length = 3;     // 3 registers (16-bit each) for P, Q, S
        config.measurements.powers.type = "int16"; // 16-bit signed integer
        config.measurements.powers.kv = 3000000;   // Restore Thytronic manual value

        // Remove fixed scale so that Pn logic formula takes over
        delete config.measurements.powers.scale;

        console.log("Updated powers config:", config.measurements.powers);
    }

    await knex("device_models")
        .where({ id: "thytronic-xmr-a" })
        .update({
            config: JSON.stringify(config),
        });

    console.log("✓ Fixed Thytronic powers (16-bit separation applied).");
};

exports.down = async function (knex) {
    const row = await knex("device_models")
        .where({ id: "thytronic-xmr-a" })
        .first();

    if (!row) return;

    const config =
        typeof row.config === "string" ? JSON.parse(row.config) : row.config;

    if (config.measurements && config.measurements.powers) {
        config.measurements.powers.length = 6;
        delete config.measurements.powers.type;
        config.measurements.powers.scale = 0.001;
        config.measurements.powers.kv = 425609; // previous bugged Kv
    }

    await knex("device_models")
        .where({ id: "thytronic-xmr-a" })
        .update({
            config: JSON.stringify(config),
        });
};
