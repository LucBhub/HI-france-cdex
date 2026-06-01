// Measurement types and configurations

export const MEASUREMENT_TYPES = {
  NOMINAL: "nominal",
  CURRENT: "current",
  VOLTAGE_PN: "voltage_pn",
  VOLTAGE_PP: "voltage_pp",
  POWER: "power",
  FREQUENCY: "frequency",
} as const;

export type MeasurementType =
  (typeof MEASUREMENT_TYPES)[keyof typeof MEASUREMENT_TYPES];

export interface MeasurementConfig {
  id?: string;
  name: string;
  measurementType: MeasurementType;
  address: number;
  length: number;
  dataType: "UWORD" | "LONG" | "INT16";
  endianness: "big_endian" | "word_swap";
  kv: number;
  spacing?: number;
  unit: string;
  scale?: number;
  formula?: string;
  references?: string[];
}

export interface MeasurementTypeInfo {
  label: string;
  description: string;
  dataTypes: string[];
  endianness: string[];
  defaultKv: number;
}

export interface TestResult {
  success: boolean;
  rawHex?: string;
  rawDec?: number;
  calculatedValue?: number;
  unit?: string;
  formula?: string;
  calculationDetails?: string;
  references?: {
    inp?: number;
    unp?: number;
    un?: number;
  };
  error?: string;
  suggestion?: string;
}

export const MEASUREMENT_TYPE_INFO: Record<
  MeasurementType,
  MeasurementTypeInfo
> = {
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
