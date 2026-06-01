/**
 * Formula Generator for Modbus Measurements
 *
 * Automatically generates formulas and calculation functions
 * based on measurement type.
 */

const MEASUREMENT_TYPES = {
  NOMINAL: "nominal",
  CURRENT: "current",
  VOLTAGE_PN: "voltage_pn",
  VOLTAGE_PP: "voltage_pp",
  POWER: "power",
  FREQUENCY: "frequency",
};

/**
 * Generate formula and calculation function for a measurement type
 *
 * @param {string} measurementType - Type of measurement
 * @param {number} kv - Modbus scaling factor
 * @param {object} options - Additional options (unit, name)
 * @returns {object} { formula, calculate, requiredReferences, unit }
 */
function generateFormula(measurementType, kv, options = {}) {
  const { unit = "", name = "" } = options;

  switch (measurementType) {
    case MEASUREMENT_TYPES.NOMINAL:
      return {
        formula: "raw",
        formulaDisplay: "Valeur = raw",
        calculate: (raw, references) => raw,
        requiredReferences: [],
        unit: unit || "",
      };

    case MEASUREMENT_TYPES.CURRENT:
      return {
        formula: `(raw / ${kv}) * Inp`,
        formulaDisplay: `I (A) = (raw / ${kv}) × Inp`,
        calculate: (raw, references) => {
          if (!references.inp) throw new Error("Inp reference required");
          return (raw / kv) * references.inp;
        },
        requiredReferences: ["inp"],
        unit: unit || "A",
      };

    case MEASUREMENT_TYPES.VOLTAGE_PN:
      return {
        formula: `(raw / ${kv}) * Un`,
        formulaDisplay: `U (V) = (raw / ${kv}) × Un`,
        calculate: (raw, references) => {
          if (!references.un) throw new Error("Un reference required");
          return (raw / kv) * references.un;
        },
        requiredReferences: ["un"],
        unit: unit || "V",
      };

    case MEASUREMENT_TYPES.VOLTAGE_PP:
      return {
        formula: `(raw / ${kv}) * Unp`,
        formulaDisplay: `U (V) = (raw / ${kv}) × Unp`,
        calculate: (raw, references) => {
          if (!references.unp) throw new Error("Unp reference required");
          return (raw / kv) * references.unp;
        },
        requiredReferences: ["unp"],
        unit: unit || "V",
      };

    case MEASUREMENT_TYPES.POWER:
      return {
        formula: `(raw / ${kv}) * Pn`,
        formulaDisplay: `P (kW) = (raw / ${kv}) × Pn\nPn = √3 × Unp × Inp / 1,000,000`,
        calculate: (raw, references) => {
          if (!references.unp || !references.inp) {
            throw new Error("Unp and Inp references required");
          }
          const pn = (Math.sqrt(3) * references.unp * references.inp) / 1000000;
          return (raw / kv) * pn;
        },
        requiredReferences: ["unp", "inp"],
        unit: unit || "kW",
      };

    case MEASUREMENT_TYPES.FREQUENCY:
      return {
        formula: `raw / ${kv}`,
        formulaDisplay: `f (Hz) = raw / ${kv}`,
        calculate: (raw, references) => raw / kv,
        requiredReferences: [],
        unit: unit || "Hz",
      };

    default:
      throw new Error(`Unknown measurement type: ${measurementType}`);
  }
}

/**
 * Validate measurement configuration
 *
 * @param {object} config - Measurement configuration
 * @param {object} references - Available references (inp, unp, un)
 * @returns {object} { valid, errors }
 */
function validateMeasurementConfig(config, references = {}) {
  const errors = [];

  // Validate required fields
  if (!config.measurementType) {
    errors.push("Measurement type is required");
  }

  if (config.address === undefined || config.address === null) {
    errors.push("Address is required");
  }

  if (!config.dataType) {
    errors.push("Data type is required");
  }

  if (config.kv === undefined || config.kv === null || config.kv <= 0) {
    errors.push("Kv must be a positive number");
  }

  // Validate references
  try {
    const formula = generateFormula(config.measurementType, config.kv || 1);

    for (const ref of formula.requiredReferences) {
      if (!references[ref]) {
        errors.push(
          `${ref.toUpperCase()} reference is required for this measurement type`,
        );
      }
    }
  } catch (error) {
    errors.push(error.message);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Get measurement type info
 *
 * @param {string} measurementType
 * @returns {object} { label, description, dataTypes, endianness }
 */
function getMeasurementTypeInfo(measurementType) {
  const info = {
    [MEASUREMENT_TYPES.NOMINAL]: {
      label: "Valeur Nominale",
      description: "Valeur brute sans calcul (Inp, Unp, In, Un)",
      dataTypes: ["UWORD"],
      endianness: ["big_endian"],
      defaultKv: 1,
    },
    [MEASUREMENT_TYPES.CURRENT]: {
      label: "Courant",
      description: "Mesure de courant (L1, L2, L3)",
      dataTypes: ["UWORD", "LONG"],
      endianness: ["big_endian", "word_swap"],
      defaultKv: 16000,
    },
    [MEASUREMENT_TYPES.VOLTAGE_PN]: {
      label: "Tension Phase-Neutre",
      description: "Tension entre phase et neutre",
      dataTypes: ["LONG"],
      endianness: ["word_swap"],
      defaultKv: 112000,
    },
    [MEASUREMENT_TYPES.VOLTAGE_PP]: {
      label: "Tension Phase-Phase",
      description: "Tension composée (U12, U23, U31)",
      dataTypes: ["LONG"],
      endianness: ["word_swap"],
      defaultKv: 112000,
    },
    [MEASUREMENT_TYPES.POWER]: {
      label: "Puissance",
      description: "Puissance active, réactive ou apparente",
      dataTypes: ["LONG"],
      endianness: ["big_endian"],
      defaultKv: 3000000,
    },
    [MEASUREMENT_TYPES.FREQUENCY]: {
      label: "Fréquence",
      description: "Fréquence du réseau",
      dataTypes: ["LONG"],
      endianness: ["word_swap"],
      defaultKv: 1000,
    },
  };

  return info[measurementType] || null;
}

module.exports = {
  MEASUREMENT_TYPES,
  generateFormula,
  validateMeasurementConfig,
  getMeasurementTypeInfo,
};
