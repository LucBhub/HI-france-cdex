exports.up = async function (knex) {
  const row = await knex("device_models")
    .where({ id: "thytronic-xmr-a" })
    .first();
  if (!row) return;

  const config =
    typeof row.config === "string" ? JSON.parse(row.config) : row.config;

  // Invert breaker status logic (0=Closed, 1=Open on this relay)
  if (config.breakerStatus) {
    config.breakerStatus.invert = true;
  }

  await knex("device_models")
    .where({ id: "thytronic-xmr-a" })
    .update({
      config: JSON.stringify(config),
    });
};

exports.down = async function (knex) {
  // No down
};
