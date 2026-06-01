exports.up = async function (knex) {
  const row = await knex("device_models")
    .where({ id: "thytronic-xmr-a" })
    .first();
  if (!row) return;

  const config =
    typeof row.config === "string" ? JSON.parse(row.config) : row.config;

  // Switch Voltage Address from 400 (Phase V, L3 Error) to 408 (Line V?, Balanced)
  // Scan showed valid ~112V values at 408, 410, 412.
  if (config.measurements && config.measurements.voltages) {
    config.measurements.voltages.address = 408;
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
