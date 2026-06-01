exports.up = async function (knex) {
  const row = await knex("device_models")
    .where({ id: "thytronic-xmr-a" })
    .first();
  if (!row) return;

  const config =
    typeof row.config === "string" ? JSON.parse(row.config) : row.config;

  // Tune PF down to 0.88 to be conservative/exact match for 6720/7500
  // User complaint "Still too high"
  if (config.measurements && config.measurements.powers) {
    config.measurements.powers.est_pf = 0.88;
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
