exports.up = async function (knex) {
  const row = await knex("device_models")
    .where({ id: "thytronic-xmr-a" })
    .first();
  if (!row) return;

  const config =
    typeof row.config === "string" ? JSON.parse(row.config) : row.config;

  // Tune PF back to 0.90 based on user feedback "2697 vs 3346" (Too Low)
  // 3346 (Real) / 3718 (Apparent) = 0.90
  if (config.measurements && config.measurements.powers) {
    config.measurements.powers.est_pf = 0.9;
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
