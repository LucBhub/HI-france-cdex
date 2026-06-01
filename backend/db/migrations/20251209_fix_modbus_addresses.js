/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function (knex) {
  // Fetch existing config
  const row = await knex("device_models")
    .where({ id: "thytronic-xmr-a" })
    .first();
  if (!row) return;

  const config =
    typeof row.config === "string" ? JSON.parse(row.config) : row.config;

  // Fix ONLY nominal values according to Thytronic manual:
  // - Type: UWORD (16-bit) not ULONG (32-bit)
  // - Length: 1 register (not 2)
  // - Address: IDX - 1

  config.nominal.inp = {
    address: 77, // IDX 78 - 1
    type: "uword", // 16-bit unsigned
    length: 1, // 1 register = 2 bytes
  };

  config.nominal.unp = {
    address: 85, // IDX 86 - 1
    type: "uword", // 16-bit unsigned
    length: 1, // 1 register = 2 bytes
  };

  config.nominal.in_nom = {
    address: 73, // IDX 74 - 1
    type: "uword", // 16-bit unsigned
    length: 1, // 1 register = 2 bytes
  };

  config.nominal.un_nom = {
    address: 81, // IDX 82 - 1
    type: "uword", // 16-bit unsigned
    length: 1, // 1 register = 2 bytes
  };

  // Leave measurements UNCHANGED for now
  // (currents, voltages, frequency, powers remain as-is)

  // Update DB
  await knex("device_models")
    .where({ id: "thytronic-xmr-a" })
    .update({
      config: JSON.stringify(config),
    });

  console.log("✓ Fixed nominal values: Inp, Unp, In, Un (UWORD, IDX-1)");
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function (knex) {
  // Revert to old configuration
  const row = await knex("device_models")
    .where({ id: "thytronic-xmr-a" })
    .first();
  if (!row) return;

  const config =
    typeof row.config === "string" ? JSON.parse(row.config) : row.config;

  // Revert to original (incorrect) values
  config.nominal.inp = { address: 78, type: "ulong", length: 2 };
  config.nominal.unp = { address: 86, type: "ulong", length: 2 };
  config.nominal.in_nom = { address: 74, type: "ulong", length: 2 };
  config.nominal.un_nom = { address: 82, type: "ulong", length: 2 };

  await knex("device_models")
    .where({ id: "thytronic-xmr-a" })
    .update({
      config: JSON.stringify(config),
    });
};
