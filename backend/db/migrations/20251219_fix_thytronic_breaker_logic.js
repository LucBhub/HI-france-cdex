exports.up = async function (knex) {
  const row = await knex("device_models")
    .where({ id: "thytronic-xmr-a" })
    .first();
  if (!row) return;

  let config =
    typeof row.config === "string" ? JSON.parse(row.config) : row.config;

  // Fix: Revert to standard logic
  // Register 192, Input, 1=Closed (No Invert)
  config.breakerStatus = {
    input: 192,
    invert: false,
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
