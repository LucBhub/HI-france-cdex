// Tests unitaires pour l'agrégateur horaire
jest.mock("../../db/knex", () => {
  const mockFn = jest.fn();
  mockFn.raw = jest.fn((sql) => sql); // knex.raw utilisé dans les SELECT
  return mockFn;
});

const knex = require("../../db/knex");
const {
  aggregateHourlyData,
  backfillMissingHours,
  runCleanup,
} = require("../../cron/aggregator");

// Helper : crée un chain knex configurable
const makeChain = (opts = {}) => ({
  where: jest.fn().mockReturnThis(),
  whereBetween: jest.fn().mockReturnThis(),
  groupBy: jest.fn().mockReturnThis(),
  select: jest.fn().mockResolvedValue(opts.selectResult ?? []),
  first: jest.fn().mockResolvedValue(opts.firstResult),
  insert: jest.fn().mockResolvedValue([1]),
  del: jest.fn().mockResolvedValue(opts.delResult ?? 0),
});

beforeEach(() => {
  jest.clearAllMocks();
});

// ──────────────────────────────────────────────
// aggregateHourlyData
// ──────────────────────────────────────────────
describe("aggregateHourlyData", () => {
  test("ne fait rien s'il n'y a aucune centrale", async () => {
    knex.mockReturnValue(makeChain({ selectResult: [] }));

    await expect(aggregateHourlyData()).resolves.not.toThrow();
    // plants.select est appelé, mais on ne va jamais plus loin
    expect(knex).toHaveBeenCalledWith("plants");
    expect(knex).not.toHaveBeenCalledWith("measurements");
  });

  test("ignore une centrale si l'agrégation horaire existe déjà", async () => {
    const insertMock = jest.fn().mockResolvedValue([1]);

    knex.mockImplementation((table) => {
      if (table === "plants") {
        return { select: jest.fn().mockResolvedValue([{ id: 1 }]) };
      }
      // measurements_hourly.where().first() → enregistrement existant
      return {
        where: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue({ id: 99, plant_id: 1 }),
        insert: insertMock,
      };
    });

    await aggregateHourlyData();

    expect(insertMock).not.toHaveBeenCalled();
  });

  test("insère l'agrégat quand des données existent sans agrégation préalable", async () => {
    const insertMock = jest.fn().mockResolvedValue([1]);

    knex.mockImplementation((table) => {
      if (table === "plants") {
        return { select: jest.fn().mockResolvedValue([{ id: 1 }]) };
      }
      if (table === "measurements_hourly") {
        return {
          where: jest.fn().mockReturnThis(),
          first: jest.fn().mockResolvedValue(undefined), // pas d'agrégation existante
          insert: insertMock,
        };
      }
      if (table === "measurements") {
        return {
          where: jest.fn().mockReturnThis(),
          whereBetween: jest.fn().mockReturnThis(),
          groupBy: jest.fn().mockReturnThis(),
          select: jest.fn().mockReturnThis(),
          first: jest.fn().mockResolvedValue({
            avg_power: 10.5,
            max_power: 20.0,
            avg_voltage: 230,
            max_voltage: 242,
            min_voltage: 218,
            avg_current: 5.2,
            max_current: 8.1,
          }),
        };
      }
      return makeChain({});
    });

    await aggregateHourlyData();

    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        plant_id: 1,
        avg_power_kw: 10.5,
        max_power_kw: 20.0,
        total_energy_kwh: 10.5,
      }),
    );
  });
});

// ──────────────────────────────────────────────
// backfillMissingHours
// ──────────────────────────────────────────────
describe("backfillMissingHours", () => {
  test("insère les agrégations manquantes pour les heures passées", async () => {
    const insertMock = jest.fn().mockResolvedValue([1]);

    knex.mockImplementation((table) => {
      if (table === "plants") {
        return { select: jest.fn().mockResolvedValue([{ id: 1 }]) };
      }
      if (table === "measurements_hourly") {
        return {
          where: jest.fn().mockReturnThis(),
          first: jest.fn().mockResolvedValue(undefined), // aucune agrégation existante
          insert: insertMock,
        };
      }
      if (table === "measurements") {
        return {
          where: jest.fn().mockReturnThis(),
          whereBetween: jest.fn().mockReturnThis(),
          groupBy: jest.fn().mockReturnThis(),
          select: jest.fn().mockReturnThis(),
          first: jest.fn().mockResolvedValue({
            avg_power: 5,
            max_power: 10,
            avg_voltage: 230,
            max_voltage: 240,
            min_voltage: 220,
            avg_current: 3,
            max_current: 5,
          }),
        };
      }
      return makeChain({});
    });

    // Tester sur 2 heures pour rester rapide
    await backfillMissingHours(2);

    // Une insertion par heure manquante (2 heures × 1 centrale)
    expect(insertMock).toHaveBeenCalledTimes(2);
  });

  test("ne fait rien si toutes les agrégations existent déjà", async () => {
    const insertMock = jest.fn();

    knex.mockImplementation((table) => {
      if (table === "plants") {
        return { select: jest.fn().mockResolvedValue([{ id: 1 }]) };
      }
      return {
        where: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue({ id: 99 }), // déjà agrégé
        insert: insertMock,
      };
    });

    await backfillMissingHours(2);

    expect(insertMock).not.toHaveBeenCalled();
  });
});

// ──────────────────────────────────────────────
// runCleanup
// ──────────────────────────────────────────────
describe("runCleanup", () => {
  test("supprime les mesures brutes > 30 jours et les horaires > 1 an", async () => {
    const delMock = jest.fn().mockResolvedValue(5);

    knex.mockImplementation(() => ({
      where: jest.fn().mockReturnThis(),
      del: delMock,
    }));

    await runCleanup();

    // Un appel pour measurements, un pour measurements_hourly
    expect(delMock).toHaveBeenCalledTimes(2);
  });
});
