/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function (knex) {
  // Fetch the existing model
  const model = await knex("device_models")
    .where({ id: "thytronic-xmr-a" })
    .first();

  if (model) {
    let config =
      typeof model.config === "string"
        ? JSON.parse(model.config)
        : model.config;

    // Fix the voltage offset: 16 bytes -> 8 registers
    // Also correct length to 6 registers (3 phases * 2 registers) instead of 12
    if (config.measurements && config.measurements.voltages) {
      config.measurements.voltages.offset = 8; // 390 + 8 = 398
      config.measurements.voltages.length = 6;
    }

    await knex("device_models")
      .where({ id: "thytronic-xmr-a" })
      .update({
        config: JSON.stringify(config),
      });
  }
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function (knex) {
  const model = await knex("device_models")
    .where({ id: "thytronic-xmr-a" })
    .first();

  if (model) {
    let config =
      typeof model.config === "string"
        ? JSON.parse(model.config)
        : model.config;

    if (config.measurements && config.measurements.voltages) {
      config.measurements.voltages.offset = 16;
      config.measurements.voltages.length = 12;
    }

    await knex("device_models")
      .where({ id: "thytronic-xmr-a" })
      .update({
        config: JSON.stringify(config),
      });
  }
};
