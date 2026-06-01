exports.up = async function (knex) {
  const row = await knex("device_models")
    .where({ id: "thytronic-xmr-a" })
    .first();
  if (!row) return;

  let config =
    typeof row.config === "string" ? JSON.parse(row.config) : row.config;

  // Fix: Restore original logic causing correct 0 value
  // Register 317, Input, Invert=True
  config.breakerStatus = {
    input: 317,
    invert: true,
  };

  await knex("device_models")
    .where({ id: "thytronic-xmr-a" })
    .update({
      config: JSON.stringify(config),
    });
};

exports.down = async function (knex) {
  // No down
};
