/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function (knex) {
  const model = await knex("device_models")
    .where({ id: "thytronic-xmr-a" })
    .first();

  if (model) {
    let config =
      typeof model.config === "string"
        ? JSON.parse(model.config)
        : model.config;

    // Add reset command
    if (!config.control) {
      config.control = {};
    }
    // IDX 3 -> Address 2
    config.control.reset = 2;

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

    if (config.control && config.control.reset) {
      delete config.control.reset;
    }

    await knex("device_models")
      .where({ id: "thytronic-xmr-a" })
      .update({
        config: JSON.stringify(config),
      });
  }
};
