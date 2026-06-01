/**
 * Fix power calculation for Thytronic XMR-A (Take 2 - long_swap)
 * 
 * Root Cause Analysis:
 * - The previous fix (20260306_fix_powers_int16) assumed the registers were 16-bit.
 * - But testing the public IP on port 4002 shows Thytronic actually sends 32-bit registers!
 * - The REAL issue why production had aberrant values (3 GW) and preprod didn't:
 *   Production's database was missing `type: "long_swap"` for powers, causing
 *   modbus-utils to fall back to `type: "long"`.
 *   - Type "long": 3,398,624.82 kW (Aberrant)
 *   - Type "long_swap": -1164.84 kW (Correct!)
 * - Preproduction worked perfectly because its local database was manually configured 
 *   with "long_swap" and no direct scale, but this was never migrated to production!
 *
 * Solution:
 * - Revert the length back to 6 registers (32-bit x 3).
 * - Change the type to "long_swap".
 *
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function (knex) {
    console.log("Fixing Thytronic powers configuration to long_swap...");

    const row = await knex("device_models")
        .where({ id: "thytronic-xmr-a" })
        .first();

    if (!row) {
        throw new Error("thytronic-xmr-a model not found");
    }

    const config =
        typeof row.config === "string" ? JSON.parse(row.config) : row.config;

    if (config.measurements && config.measurements.powers) {
        config.measurements.powers.length = 6;              // Restore 32-bit x 3
        config.measurements.powers.type = "long_swap";      // The actual fix!
        config.measurements.powers.kv = 3000000;            // Keep manual value

        // Ensure scale is deleted so Pn formula works
        delete config.measurements.powers.scale;

        console.log("Updated powers config:", config.measurements.powers);
    }

    await knex("device_models")
        .where({ id: "thytronic-xmr-a" })
        .update({
            config: JSON.stringify(config),
        });

    console.log("✓ Fixed Thytronic powers (long_swap applied).");
};

exports.down = async function (knex) {
    const row = await knex("device_models")
        .where({ id: "thytronic-xmr-a" })
        .first();

    if (!row) return;

    const config =
        typeof row.config === "string" ? JSON.parse(row.config) : row.config;

    if (config.measurements && config.measurements.powers) {
        config.measurements.powers.length = 3;
        config.measurements.powers.type = "int16";
    }

    await knex("device_models")
        .where({ id: "thytronic-xmr-a" })
        .update({
            config: JSON.stringify(config),
        });
};
