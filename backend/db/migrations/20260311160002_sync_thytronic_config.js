/**
 * Definitive Sync for Thytronic XMR-A Configuration
 * 
 * Root Cause Analysis:
 * - The legacy Docker host production works perfectly because the `device_models` 
 *   database row was manually tweaked by IT over time to the perfected state:
 *   (type: "long_swap", length: 6, spacing: 2, kv: 16000 / 112000, etc.)
 * - The new Kubernetes Production environment was provisioned using sequential 
 *   Knex migrations. However, no early migration ever explicitly set `type: "long_swap"`
 *   or `kv: 16000` for Currents, Voltages, and Frequency!
 * - Because `type` was missing in Kube Prod, `modbus-utils.js` defaulted to `type: "long"`, 
 *   which drastically broke byte ordering and byte scaling across all values in Kubernetes.
 * 
 * Solution:
 * - This migration forces the `thytronic-xmr-a` config to the exact, mathematically 
 *   proven JSON structure from the Docker host database.
 * 
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function (knex) {
    console.log("Synchronizing Thytronic XMR-A config to exact Docker Host specifications...");

    const row = await knex("device_models")
        .where({ id: "thytronic-xmr-a" })
        .first();

    if (!row) {
        throw new Error("thytronic-xmr-a model not found");
    }

    const config =
        typeof row.config === "string" ? JSON.parse(row.config) : row.config;

    // 1. Force exact Nominal values that work with the Long Swap padding
    config.nominal = {
        inp: { address: 77, type: "long_swap", length: 2 },
        unp: { address: 85, type: "long_swap", length: 2 },
        in_nom: { address: 73, type: "long_swap", length: 2 },
        un_nom: { address: 81, type: "long_swap", length: 2 }
    };

    // 2. Force exact Measurement properties
    if (!config.measurements) config.measurements = {};

    config.measurements.currents = {
        address: 390,
        length: 6,
        type: "long_swap",
        kv: 16000,
        spacing: 2
    };

    config.measurements.voltages = {
        address: 398,
        length: 6,
        type: "long_swap",
        kv: 112000,
        spacing: 2
    };

    config.measurements.voltages_ll = {
        address: 408,
        length: 6,
        type: "long_swap",
        kv: 112000,
        spacing: 2
    };

    config.measurements.frequency = {
        address: 442,
        length: 2,
        type: "long_swap",
        kv: 1000,
        scale: 0.001
    };

    config.measurements.powers = {
        address: 478,
        length: 6,
        type: "long_swap",
        est_pf: 0.9,
        spacing: 2,
        kv: 3000000
    };

    await knex("device_models")
        .where({ id: "thytronic-xmr-a" })
        .update({
            config: JSON.stringify(config),
        });

    console.log("✓ Synchronized thytronic-xmr-a configuration successfully.");
};

exports.down = async function (knex) {
    // Cannot easily rollback to "broken" dynamic state without a backup, skipping.
    console.log("Revert not implemented for definitive config sync.");
};
