const knex = require("../db/knex");

// Open-Meteo API Base URL
const OPEN_METEO_API = "https://api.open-meteo.com/v1/forecast";

async function fetchIrradiationForPlant(plant, daysBack = 1, daysForward = 1) {
  if (!plant.gps) {
    console.warn(
      `[Irradiation] Plant ${plant.name} has no GPS coordinates. Skipping.`,
    );
    return;
  }

  const [lat, lng] = plant.gps.split(",").map((s) => parseFloat(s.trim()));
  if (isNaN(lat) || isNaN(lng)) {
    console.warn(
      `[Irradiation] Plant ${plant.name} has invalid GPS coordinates. Skipping.`,
    );
    return;
  }

  try {
    // Fetch Yesterday (past_days=1) and Today (forecast_days=1)
    // CRITICAL: Use timezone=GMT to ensure we get explicit UTC ISO strings. The DB stores UTC.
    // Frontend will convert to local time.
    // If we use 'auto', we get local time but as iso string without offset (e.g. 10:00),
    // which implies local, but storing it as ISO string can be ambiguous if not handled carefully.
    // Storing as UTC is safer. Open-Meteo returns YYYY-MM-DDTHH:mm for GMT if timezone=GMT.
    // We append 'Z' to ensure it's treated as UTC.

    const url = `${OPEN_METEO_API}?latitude=${lat}&longitude=${lng}&hourly=shortwave_radiation,temperature_2m&past_days=${daysBack}&forecast_days=${daysForward}&timezone=GMT`;

    console.log(`[Irradiation] Fetching data for ${plant.name} (${url})`);
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`API Error: ${response.statusText}`);
    }

    const data = await response.json();
    const hourly = data.hourly;

    if (!hourly || !hourly.time) return;

    // Prepare rows for bulk insert/upsert
    const rows = hourly.time.map((isoTime, index) => {
      // Open-Meteo with timezone=GMT returns "2023-12-15T12:00".
      // We want "2023-12-15T12:00Z" to be explicit for SQLite/Knex (UTC).
      const utcTimestamp = isoTime.endsWith("Z") ? isoTime : `${isoTime}Z`;

      return {
        plant_id: plant.id,
        timestamp: utcTimestamp,
        irradiation_wh_m2: hourly.shortwave_radiation[index] || 0,
        temperature_c: hourly.temperature_2m[index] || 0,
      };
    });

    // Upsert logic (SQLite support ON CONFLICT)
    for (const row of rows) {
      await knex("irradiation_hourly")
        .insert(row)
        .onConflict(["plant_id", "timestamp"])
        .merge(); // Update if exists
    }

    console.log(
      `[Irradiation] Synced ${rows.length} hourly records for ${plant.name}.`,
    );
  } catch (error) {
    console.error(
      `[Irradiation] Error fetching for ${plant.name}:`,
      error.message,
    );
  }
}

async function runDataSync(isStartup = false) {
  console.log(
    `[Irradiation] Starting ${isStartup ? "startup" : "daily"} sync...`,
  );
  try {
    const plants = await knex("plants").select("id", "name", "gps");

    for (const plant of plants) {
      // For startup, we ensure we have yesterday and today
      // For daily (night run), we fetch yesterday and today (to update latest)
      await fetchIrradiationForPlant(plant, 1, 1);

      // Respect rate limits (though we are well below, adding 1s delay is polite)
      await new Promise((r) => setTimeout(r, 1000));
    }
    console.log(`[Irradiation] Sync completed.`);
  } catch (error) {
    console.error("[Irradiation] Overall sync error:", error);
  }
}

function startIrradiationScheduler() {
  // 1. Run on Startup
  runDataSync(true);

  // 2. Schedule Daily Run at 01:00 AM
  // Using simple setInterval check for simplicity avoiding heavy cron lib
  setInterval(() => {
    const now = new Date();
    if (now.getHours() === 1 && now.getMinutes() === 0) {
      runDataSync();
    }
  }, 60000); // Check every minute

  console.log("[Irradiation] Scheduler started (Daily at 01:00).");
}

module.exports = {
  startIrradiationScheduler,
  fetchIrradiationForPlant, // Export for manual trigger API
  runDataSync, // Export for manual trigger API
};
