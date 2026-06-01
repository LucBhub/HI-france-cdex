/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function (knex) {
  const siprotecConfig = {
    // Nominal Values - Not needed for direct scaling but good for reference
    nominal: {},
    // Measurements
    measurements: {
      // Currents: Ia, Ib, Ic (30001-30003) -> Address 0 (Input Registers)
      // Scaling: 32767 = 3276.7 A -> factor 0.1
      currents: { address: 0, length: 3, type: "int16", scale: 0.1 },

      // Voltages: Va, Vb, Vc (30005-30007) -> Address 4
      // Scaling: 32767 = 327.67 kV = 327670 V -> factor 10
      voltages: { address: 4, length: 3, type: "int16", scale: 10 },

      // Frequency: Freq (30015) -> Address 14
      // Scaling: 32767 = 327.67 Hz -> factor 0.01
      frequency: { address: 14, length: 1, type: "int16", scale: 0.01 },

      // Powers: P, Q, S (30012-30014) -> Address 11
      // Scaling: 32767 = 327.67 MW = 327670 kW -> factor 10
      // Note: Powers block typically reads 3 values: P, Q, S
      powers: { address: 11, length: 3, type: "int16", scale: 10 },
    },
    // Status
    breakerStatus: {
      // Breaker ON Coil is 00001 (Address 0).
      // Reading this coil should return 1 if ON (Closed).
      discrete: 0,
      invert: false, // 1 = Closed
    },
    // Control
    control: {
      couple: 0, // Coil 00001 -> Breaker ON
      decouple: 1, // Coil 00002 -> Breaker OFF
    },
  };

  await knex("device_models")
    .insert({
      id: "siprotec-7sj80",
      name: "Siemens Siprotec 7SJ80",
      config: JSON.stringify(siprotecConfig),
    })
    .onConflict("id")
    .ignore();
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function (knex) {
  await knex("device_models").where({ id: "siprotec-7sj80" }).delete();
};
