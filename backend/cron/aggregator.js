const knex = require("../db/knex");

// Rattrapage des heures manquantes sur les N dernières heures.
// Appelé au démarrage pour récupérer les agrégations ratées (serveur down, redémarrage, etc.)
async function backfillMissingHours(hoursBack = 48) {
  console.log(`[Aggregator] Backfill: checking last ${hoursBack} hours...`);

  const now = new Date();
  let filled = 0;

  for (let i = 1; i <= hoursBack; i++) {
    const slotStart = new Date(now.getTime() - i * 60 * 60 * 1000);
    slotStart.setMinutes(0, 0, 0);

    const slotEnd = new Date(slotStart);
    slotEnd.setMinutes(59, 59, 999);

    const startTimeStr = slotStart.toISOString();
    const endTimeStr = slotEnd.toISOString();

    try {
      const plants = await knex("plants").select("id");

      for (const plant of plants) {
        const existing = await knex("measurements_hourly")
          .where({ plant_id: plant.id, timestamp: startTimeStr })
          .first();

        if (existing) continue;

        const result = await knex("measurements")
          .where({ plant_id: plant.id })
          .whereBetween("timestamp", [startTimeStr, endTimeStr])
          .groupBy("plant_id")
          .select(
            knex.raw("avg(power_kw) as avg_power"),
            knex.raw("max(power_kw) as max_power"),
            knex.raw("avg(voltage_v) as avg_voltage"),
            knex.raw("max(voltage_v) as max_voltage"),
            knex.raw("min(voltage_v) as min_voltage"),
            knex.raw("avg(current_a) as avg_current"),
            knex.raw("max(current_a) as max_current"),
          )
          .first();

        if (result) {
          await knex("measurements_hourly").insert({
            plant_id: plant.id,
            timestamp: startTimeStr,
            avg_power_kw: result.avg_power || 0,
            max_power_kw: result.max_power || 0,
            total_energy_kwh: result.avg_power || 0,
            avg_voltage_v: result.avg_voltage || 0,
            max_voltage_v: result.max_voltage || 0,
            min_voltage_v: result.min_voltage || 0,
            avg_current_a: result.avg_current || 0,
            max_current_a: result.max_current || 0,
          });
          filled++;
          console.log(
            `[Aggregator] Backfill: inserted missing aggregation plant=${plant.id} slot=${startTimeStr}`,
          );
        }
      }
    } catch (error) {
      console.error(
        `[Aggregator] Backfill error at slot ${startTimeStr}:`,
        error,
      );
    }
  }

  console.log(`[Aggregator] Backfill complete: ${filled} slot(s) filled.`);
}

async function aggregateHourlyData() {
  console.log("[Aggregator] Starting hourly aggregation...");

  // TODO: Si le cron rate une exécution (serveur down à H+5), l'heure correspondante n'est jamais agrégée.
  // Il faudrait un script de "rattrapage" qui vérifie les heures manquantes dans measurements_hourly
  // et les agrège rétroactivement. Pour l'instant, on agrège juste l'heure précédente.

  // We want to aggregate data for the last completed hour (or check for missing aggregations)
  // For simplicity, let's look for hours in 'measurements' that don't exist in 'measurements_hourly'
  // but that might be heavy.
  // Better: Define a range. E.g. Previous 24 hours.

  const now = new Date();
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
  const startOfPreviousHour = new Date(oneHourAgo);
  startOfPreviousHour.setMinutes(0, 0, 0); // XX:00:00

  const endOfPreviousHour = new Date(startOfPreviousHour);
  endOfPreviousHour.setMinutes(59, 59, 999);

  // Format for DB (ISO string usually works with Knex/SQLite)
  const startTimeStr = startOfPreviousHour.toISOString();
  const endTimeStr = endOfPreviousHour.toISOString();

  try {
    // Get all plants
    const plants = await knex("plants").select("id");

    for (const plant of plants) {
      // Check if aggregation already exists
      const existing = await knex("measurements_hourly")
        .where({ plant_id: plant.id, timestamp: startTimeStr })
        .first();

      if (existing) continue;

      // Calculate aggregates
      const result = await knex("measurements")
        .where({ plant_id: plant.id })
        .whereBetween("timestamp", [startTimeStr, endTimeStr])
        .groupBy("plant_id")
        .select(
          knex.raw("avg(power_kw) as avg_power"),
          knex.raw("max(power_kw) as max_power"),
          knex.raw("avg(voltage_v) as avg_voltage"),
          knex.raw("max(voltage_v) as max_voltage"),
          knex.raw("min(voltage_v) as min_voltage"),
          knex.raw("avg(current_a) as avg_current"),
          knex.raw("max(current_a) as max_current"),
        )
        .first();

      if (result) {
        await knex("measurements_hourly").insert({
          plant_id: plant.id,
          timestamp: startTimeStr,
          avg_power_kw: result.avg_power || 0,
          max_power_kw: result.max_power || 0,
          // Power is kW, sampled every 10 min.
          // Energy (kWh) = Average Power (kW) * 1 hour.
          // So avg_power is roughly energy in kWh for that hour assuming constant load.
          // Better: Trapezoidal rule but avg is fine for 10min samples.
          total_energy_kwh: result.avg_power || 0,

          avg_voltage_v: result.avg_voltage || 0,
          max_voltage_v: result.max_voltage || 0,
          min_voltage_v: result.min_voltage || 0,

          avg_current_a: result.avg_current || 0,
          max_current_a: result.max_current || 0,
        });
        console.log(
          `[Aggregator] Aggregated plant ${plant.id} for ${startTimeStr}`,
        );
      }
    }
  } catch (error) {
    console.error("[Aggregator] Error during aggregation:", error);
  }
}

async function runCleanup() {
  console.log("[Aggregator] Starting data cleanup...");
  try {
    // 1. Delete Raw Measurements > 30 days
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const delRaw = await knex("measurements")
      .where("timestamp", "<", thirtyDaysAgo.toISOString())
      .del();
    if (delRaw > 0)
      console.log(`[Aggregator] Deleted ${delRaw} old raw measurements.`);

    // 2. Delete Hourly > 1 year
    const oneYearAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
    const delHourly = await knex("measurements_hourly")
      .where("timestamp", "<", oneYearAgo.toISOString())
      .del();
    if (delHourly > 0)
      console.log(`[Aggregator] Deleted ${delHourly} old hourly records.`);
  } catch (error) {
    console.error("[Aggregator] Error during cleanup:", error);
  }
}

function startAggregatorScheduler() {
  // 1. Aggregation: Run every hour at minute 5
  setInterval(() => {
    const now = new Date();
    if (now.getMinutes() === 5) {
      aggregateHourlyData();
    }
  }, 60000);

  // 2. Cleanup: Run every night at 02:00
  setInterval(() => {
    const now = new Date();
    if (now.getHours() === 2 && now.getMinutes() === 0) {
      runCleanup();
    }
  }, 60000);

  // Rattraper les heures manquantes des 48 dernières heures (redémarrage, downtime, etc.)
  backfillMissingHours(48);

  // Run cleanup once on startup just in case
  runCleanup();

  console.log(
    "[Aggregator] Scheduler started (Hourly Aggregation, Nightly Cleanup).",
  );
}

module.exports = {
  startAggregatorScheduler,
  aggregateHourlyData,
  backfillMissingHours,
  runCleanup,
};
