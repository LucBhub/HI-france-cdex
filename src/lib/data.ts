// NOTE: This file now only serves as a type definition and initial seed data source.
// The application logic now fetches data from the backend API.

export type Relay = {
  id: number;
  plantId: number;
  ipAddress: string;
  port?: number;
  unitId?: number;
  modelId?: string; // Add modelId
  voltageL1?: number;
  voltageL2?: number;
  voltageL3?: number;
  currentL1?: number;
  currentL2?: number;
  currentL3?: number;
  activePower?: number;
  reactivePower?: number;
  apparentPower?: number;
  frequency?: number;
  breakerStatus?: boolean;
  lastUpdated?: string;
  status?: string; // 'online' or 'offline' from API
};

export type Plant = {
  id: number;
  source?: "legacy_modbus" | "france_ignition";
  architectureSiteId?: number;
  siteCode?: string;
  client?: string | null;
  posteCount?: number;
  celluleCount?: number;
  equipementCount?: number;
  onduleurCount?: number;
  hasArchitecture?: boolean;
  telemetryStatus?: "legacy_polling" | "not_connected" | "simulated";
  name: string;
  status: "operational" | "maintenance" | "offline";
  powerOutput: number; // current apparent power in kW
  ce: string;
  address: string;
  gps: string;
  powerKwc: number;
  modemLogin: string;
  modemPassword: string;
  acrMerignac: string;
  deliveryStation: string;
  departureStation: string;
  sourceStation: string;
  card1: string;
  email?: string; // Add email
  relays: Relay[];
  // --- New Diagnostic Fields ---
  totalEnergy: number;
  frequency: number;
  currentL1: number;
  currentL2: number;
  currentL3: number;
  voltageU12: number;
  voltageU23: number;
  voltageU31: number;
};

export type Alarm = {
  id: number;
  plantName: string;
  plantId: number;
  message: string;
  priority: "high" | "medium" | "low" | "cleared";
  status: "active" | "unacknowledged" | "shelved";
  timestamp: string;
  label: string;
  name: string;
};

export const solarPlants: Plant[] = [
  {
    id: 1,
    name: "Alpha Solar One",
    status: "operational",
    powerOutput: 150, // Seed data assumes kW; adjust according to actual scaling
    ce: "Nicolas Saussieau",
    address: "RD 111 - LIEU DIT ARGILAS, 33650 SAUCATS",
    gps: "44.6172637939,-0.618754029274",
    powerKwc: 4997,
    modemLogin: "REDACTED",
    modemPassword: "",
    acrMerignac: "05 57 62 38 27",
    deliveryStation: "ARGILAS",
    departureStation: "DOUENCE",
    sourceStation: "SAUCATS",
    card1: "5 251 950",
    relays: [
      { id: 1, plantId: 1, ipAddress: "10.8.1.10", port: 502, unitId: 1 },
    ],
    totalEnergy: 123456,
    frequency: 50.01,
    currentL1: 21.5,
    currentL2: 21.4,
    currentL3: 21.6,
    voltageU12: 400.1,
    voltageU23: 400.5,
    voltageU31: 400.3,
  },
  {
    id: 2,
    name: "Beta Fields",
    status: "offline",
    powerOutput: 0,
    ce: "Jean Dupont",
    address: "123 Rue de la Panne, 75000 Paris",
    gps: "48.8566,2.3522",
    powerKwc: 0,
    modemLogin: "REDACTED",
    modemPassword: "",
    acrMerignac: "N/A",
    deliveryStation: "BETA",
    departureStation: "CHAMP",
    sourceStation: "VILLE",
    card1: "N/A",
    relays: [
      { id: 2, plantId: 2, ipAddress: "10.8.2.20", port: 502, unitId: 1 },
    ],
    totalEnergy: 0,
    frequency: 0,
    currentL1: 0,
    currentL2: 0,
    currentL3: 0,
    voltageU12: 0,
    voltageU23: 0,
    voltageU31: 0,
  },
  {
    id: 3,
    name: "Gamma Power Station",
    status: "maintenance",
    powerOutput: 75,
    ce: "Marie Curie",
    address: "456 Avenue de la Maintenance, 69000 Lyon",
    gps: "45.7640,4.8357",
    powerKwc: 3000,
    modemLogin: "REDACTED",
    modemPassword: "",
    acrMerignac: "04 72 00 00 01",
    deliveryStation: "GAMMA",
    departureStation: "STATION",
    sourceStation: "LYON",
    card1: "3 141 592",
    relays: [
      { id: 3, plantId: 3, ipAddress: "10.8.3.30", port: 502, unitId: 1 },
    ],
    totalEnergy: 98765,
    frequency: 49.98,
    currentL1: 10.1,
    currentL2: 10.0,
    currentL3: 10.2,
    voltageU12: 399.8,
    voltageU23: 399.9,
    voltageU31: 400.0,
  },
];

export const alarms: Alarm[] = [
  {
    id: 1,
    plantName: "Beta Fields",
    plantId: 2,
    message: "Inverter 3 offline: communication loss.",
    priority: "high" as const,
    status: "active" as const,
    timestamp: "2024-05-21T10:30:00Z",
    label: "ARGILAS / PDL",
    name: "Porte HTA",
  },
  {
    id: 2,
    plantName: "Gamma Power Station",
    plantId: 3,
    message: "Panel cleaning overdue for sector B.",
    priority: "medium" as const,
    status: "active" as const,
    timestamp: "2024-05-21T09:15:00Z",
    label: "GAMMA",
    name: "Nettoyage",
  },
  {
    id: 3,
    plantName: "Alpha Solar One",
    plantId: 1,
    message: "High temperature warning on transformer 1.",
    priority: "medium" as const,
    status: "unacknowledged" as const,
    timestamp: "2024-05-20T18:00:00Z",
    label: "ARGILAS",
    name: "DEIE - Mise en RSE",
  },
];
