exports.up = async function (knex) {
  const thytronicConfig = {
    // Nominal Values
    nominal: {
      inp: { address: 78, type: "ulong", length: 2, kv: 100 }, // Updated: 78
      unp: { address: 86, type: "ulong", length: 2, kv: 100 }, // Updated: 86
    },
    // Measurements
    measurements: {
      currents: { address: 391, length: 14, scale: 0.001 }, // Updated: 391
      voltages: { address: 399, offset: 16, length: 12, scale: 0.001 }, // Updated: 399
      frequency: { address: 442, length: 2, scale: 0.001 },
      powers: {
        address: 479,
        length: 6,
        scale: 0.001,
        formula: "((val / 3000000) * Pn) / 1000",
      }, // Updated: 479
    },
    // Status
    breakerStatus: {
      discrete: 317,
      holding: 317,
    },
    // Control Coils (IDX - 1)
    control: {
      couple: 15, // IDX 16
      decouple: 14, // IDX 15
    },
  };

  // Update the existing row
  await knex("device_models")
    .where({ id: "thytronic-xmr-a" })
    .update({
      config: JSON.stringify(thytronicConfig),
    });
};

exports.down = async function (knex) {
  // Revert to the "old" (incorrect but original) config if needed
  // For now, we'll just leave it as this is a fix.
  // Ideally we would put back the old config here.
};
