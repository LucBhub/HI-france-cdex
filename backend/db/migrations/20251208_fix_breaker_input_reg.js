exports.up = async function (knex) {
  const row = await knex("device_models")
    .where({ id: "thytronic-xmr-a" })
    .first();
  if (!row) return;

  const config =
    typeof row.config === "string" ? JSON.parse(row.config) : row.config;

  // User requested: Read Breaker Status as Input Register (3x)
  // Register: 317 (Input)
  // Invert: Keeping true as previously deduced (0=Closed)
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
