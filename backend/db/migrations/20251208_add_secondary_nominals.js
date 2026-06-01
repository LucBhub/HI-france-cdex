exports.up = async function (knex) {
  // Fetch existing config first to preserve other fields
  const row = await knex("device_models")
    .where({ id: "thytronic-xmr-a" })
    .first();
  if (!row) return;

  const config =
    typeof row.config === "string" ? JSON.parse(row.config) : row.config;

  // Add In (Secondary Current) and Un (Secondary Voltage)
  // We use names 'in_nom' and 'un_nom' to avoid conflict with 'inp'/'unp'
  config.nominal.in_nom = { address: 74, type: "ulong", length: 2 };
  config.nominal.un_nom = { address: 82, type: "ulong", length: 2 };

  // Update DB
  await knex("device_models")
    .where({ id: "thytronic-xmr-a" })
    .update({
      config: JSON.stringify(config),
    });
};

exports.down = async function (knex) {
  // Revert logic omitted for speed, this is a fix.
};
