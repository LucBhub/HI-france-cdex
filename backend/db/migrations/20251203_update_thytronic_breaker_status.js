/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function (knex) {
  // Fetch the existing configuration
  const model = await knex("device_models")
    .where({ id: "thytronic-xmr-a" })
    .first();

  if (model) {
    let config = model.config;

    // Ensure it's an object if it came back as a string (depends on driver/knex config)
    if (typeof config === "string") {
      config = JSON.parse(config);
    }

    // Update breakerStatus to use Input Register 191 (IDX 192)
    config.breakerStatus = {
      input: 191,
    };

    // Save back to DB
    await knex("device_models")
      .where({ id: "thytronic-xmr-a" })
      .update({
        config: JSON.stringify(config),
      });

    console.log("Updated thytronic-xmr-a breaker status to Input Register 191");
  }
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function (knex) {
  // Revert to previous default (Discrete 317)
  const model = await knex("device_models")
    .where({ id: "thytronic-xmr-a" })
    .first();

  if (model) {
    let config = model.config;
    if (typeof config === "string") {
      config = JSON.parse(config);
    }

    config.breakerStatus = {
      discrete: 317,
      holding: 317,
    };

    await knex("device_models")
      .where({ id: "thytronic-xmr-a" })
      .update({
        config: JSON.stringify(config),
      });
  }
};
