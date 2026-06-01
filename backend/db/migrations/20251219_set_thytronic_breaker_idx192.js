exports.up = async function (knex) {
  const row = await knex("device_models")
    .where({ id: "thytronic-xmr-a" })
    .first();
  if (!row) return;

  let config =
    typeof row.config === "string" ? JSON.parse(row.config) : row.config;

  // User Recommendation: IDX 192 -> Address 191
  // Logic: 0=Open, 1=Closed -> Standard (No Invert)
  config.breakerStatus = {
    input: 191,
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
