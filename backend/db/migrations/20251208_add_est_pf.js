exports.up = async function (knex) {
  const row = await knex("device_models")
    .where({ id: "thytronic-xmr-a" })
    .first();
  if (!row) return;

  const config =
    typeof row.config === "string" ? JSON.parse(row.config) : row.config;

  // Add Estimated Power Factor to align Apparent Power (V*I) with Real Power
  // User data: 6720 / 7200 = 0.933
  if (config.measurements && config.measurements.powers) {
    config.measurements.powers.est_pf = 0.933;
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
