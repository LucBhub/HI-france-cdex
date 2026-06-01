const express = require("express");
const router = express.Router();
const knex = require("../db/knex");
const authMiddleware = require("../middleware/auth");

/**
 * GET /dashboard
 * Synthetic KPIs for the Dashboard
 */
router.get(
  "/dashboard",
  authMiddleware(["member", "admin", "superadmin"]),
  async (req, res) => {
    try {
      const { start, end } = req.query;
      const endDate = end ? new Date(end) : new Date();
      const startDate = start
        ? new Date(start)
        : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

      // 1. Availability (Online Relays / Total Relays)
      const totalRelaysDesc = await knex("relays").count("id as count").first();
      const totalRelays = totalRelaysDesc.count || 1;

      const onlineRelaysDesc = await knex("relays")
        .where({ breakerStatus: true })
        .count("id as count")
        .first();
      const onlineRelays = onlineRelaysDesc.count || 0;

      const availability = (onlineRelays / totalRelays) * 100;

      // 2. Global PR Proxy (Average Power / Installed Capacity roughly)
      // Using Measurements Hourly aggregation.
      const measurements = await knex("measurements_hourly")
        .whereBetween("timestamp", [
          startDate.toISOString(),
          endDate.toISOString(),
        ])
        .select(
          knex.raw("SUM(total_energy_kwh) as total_energy"),
          // We don't have PR columns yet, so let's stick to total energy for now or average power
          knex.raw("AVG(avg_power_kw) as avg_power"),
        )
        .first();

      // 3. Active Incidents (Real-time)
      const activeFaultsDesc = await knex("relay_faults")
        .where({ is_active: true })
        .count("id as count")
        .first();
      const activeFaults = activeFaultsDesc.count || 0;

      // 4. Interventions (Last 24h)
      const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const interventionsDesc = await knex("audit_logs")
        .where("action", "RELAY_CONTROL")
        .where("created_at", ">=", last24h.toISOString())
        .count("id as count")
        .first();
      const interventions24h = interventionsDesc.count || 0;

      // 5. Top Producers (Ranking)
      const topProducers = await knex("measurements_hourly")
        .join("plants", "measurements_hourly.plant_id", "plants.id")
        .whereBetween("measurements_hourly.timestamp", [
          startDate.toISOString(),
          endDate.toISOString(),
        ])
        .groupBy("plants.name", "plants.powerKwc")
        .select("plants.name")
        .sum("measurements_hourly.total_energy_kwh as production")
        .select(
          knex.raw(
            'SUM(measurements_hourly.total_energy_kwh) / COALESCE(NULLIF(plants."powerKwc", 0), 1) as yield',
          ),
        )
        .orderBy("production", "desc")
        .limit(5);

      // 6. Worst Offenders (Most faults)
      const worstOffenders = await knex("relay_faults")
        .join("relays", "relay_faults.relay_id", "relays.id")
        .join("plants", "relays.plantId", "plants.id")
        .where((builder) => {
          builder
            .whereBetween("relay_faults.created_at", [
              startDate.toISOString(),
              endDate.toISOString(),
            ])
            .orWhere("relay_faults.is_active", true);
        })
        .groupBy("plants.name", "relays.id")
        .select("plants.name as plant_name", "relays.id as relay_id")
        .count("relay_faults.id as fault_count")
        .orderBy("fault_count", "desc")
        .limit(5);

      res.json({
        kpi: {
          availability: parseFloat(availability.toFixed(1)),
          total_energy_mwh: measurements
            ? (measurements.total_energy / 1000).toFixed(2)
            : 0,
          active_incidents: activeFaults,
          interventions_24h: interventions24h,
        },
        top_producers: topProducers,
        worst_offenders: worstOffenders,
      });
    } catch (error) {
      console.error("[Reports] Dashboard Error:", error);
      res.status(500).json({ error: "Failed to generate dashboard data." });
    }
  },
);

/**
 * GET /analysis
 * Detailed stats with deduplication logic
 */
router.get(
  "/analysis",
  authMiddleware(["member", "admin", "superadmin"]),
  async (req, res) => {
    try {
      const { start, end, type } = req.query;
      const endDate = end ? new Date(end) : new Date();
      const startDate = start
        ? new Date(start)
        : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

      // --- 1. INTERVENTIONS (Deduplicated) ---
      const logs = await knex("audit_logs")
        .where("action", "RELAY_CONTROL")
        .whereBetween("created_at", [
          startDate.toISOString(),
          endDate.toISOString(),
        ])
        .orderBy("created_at", "asc");

      const aggregatedInterventions = [];
      const DEDUP_WINDOW_MS = 5 * 60 * 1000;
      let lastLog = {};

      logs.forEach((log) => {
        const details = JSON.parse(log.details || "{}");
        const key = `${log.username}-${log.target_id}-${details.command}`;
        const logTime = new Date(log.created_at).getTime();

        // Ignore duplicate commands within window
        if (lastLog[key] && logTime - lastLog[key].time < DEDUP_WINDOW_MS)
          return;

        lastLog[key] = { time: logTime };

        // Normalize username (handle inconsistent casing from Azure/Login)
        const rawUsername = log.username || "Unknown";
        const username = rawUsername.toLowerCase();

        // Console log for debug
        // console.log(`[Reports] Processing log: User=${rawUsername} (${username}), Action=${details.command}`);

        let existingUser = aggregatedInterventions.find(
          (u) => u.username.toLowerCase() === username,
        );
        if (!existingUser) {
          existingUser = {
            username: rawUsername, // Keep original display name (first encounter)
            count: 0,
            recouples: 0,
            resets: 0,
          };
          aggregatedInterventions.push(existingUser);
        }

        existingUser.count++;
        if (details.command === "couple") existingUser.recouples++;
        if (details.command === "reset") existingUser.resets++;
      });

      aggregatedInterventions.sort((a, b) => b.count - a.count);

      // --- 2. DECOUPLING ANALYSIS ---
      const totalFaultsResult = await knex("relay_faults")
        .whereBetween("created_at", [
          startDate.toISOString(),
          endDate.toISOString(),
        ])
        .count("id as count")
        .first();
      const totalDecouplings = totalFaultsResult.count || 0;
      const remoteRecouples = aggregatedInterventions.reduce(
        (sum, user) => sum + user.recouples,
        0,
      );
      const unresolvedRemotely = Math.max(
        0,
        totalDecouplings - remoteRecouples,
      );

      // --- 3. INCIDENT PARETO ---
      const incidentsByType = await knex("relay_faults")
        .whereBetween("created_at", [
          startDate.toISOString(),
          endDate.toISOString(),
        ])
        .groupBy("fault_type")
        .select("fault_type")
        .count("id as count")
        .orderBy("count", "desc");

      // --- 4. PRODUCTION TREND ---
      const { group_by } = req.query;
      let productionTrend;

      if (group_by === "month") {
        const dateLabelSql = "to_char(timestamp, 'YYYY-MM') as date_label";

        productionTrend = await knex("measurements_hourly")
          .whereBetween("timestamp", [
            startDate.toISOString(),
            endDate.toISOString(),
          ])
          .select(knex.raw(dateLabelSql))
          .sum("total_energy_kwh as energy")
          .groupBy("date_label")
          .orderBy("date_label", "asc");

        // Map back to expected format (timestamp property used by frontend)
        productionTrend = productionTrend.map((r) => ({
          timestamp: r.date_label, // "2025-01"
          energy: r.energy,
        }));
      } else {
        // Default: Hourly
        productionTrend = await knex("measurements_hourly")
          .whereBetween("timestamp", [
            startDate.toISOString(),
            endDate.toISOString(),
          ])
          .select("timestamp")
          .sum("total_energy_kwh as energy")
          .groupBy("timestamp")
          .orderBy("timestamp", "asc");
      }

      // --- 5. PATTERN ANALYSIS ---
      const patterns = [];

      // A. HAMMERING (> 5 attempts/30min)
      const hammerGroup = {};
      logs.forEach((log) => {
        if (!log.target_id) return;
        const timeSlot = Math.floor(
          new Date(log.created_at).getTime() / (30 * 60 * 1000),
        );
        const key = `${log.username}-${log.target_id}-${timeSlot}`;
        if (!hammerGroup[key])
          hammerGroup[key] = {
            count: 0,
            relayId: log.target_id,
            user: log.username,
            time: log.created_at,
          };
        hammerGroup[key].count++;
      });

      Object.values(hammerGroup).forEach((group) => {
        if (group.count > 5) {
          patterns.push({
            type: "HAMMERING",
            severity: "medium",
            message: `L'utilisateur ${group.user} a envoyé ${group.count} commandes en < 30min sur le relais/plante ${group.relayId}.`,
            timestamp: group.time,
          });
        }
      });

      const rawFaults = await knex("relay_faults")
        .whereBetween("created_at", [
          startDate.toISOString(),
          endDate.toISOString(),
        ])
        .select("id", "relay_id", "created_at", "fault_type")
        .orderBy("created_at", "asc");

      // B. SHORT CYCLING (Fault < 5 mins after Couple)
      const coupleLogs = logs.filter((l) => {
        const d = JSON.parse(l.details || "{}");
        return d.command === "couple";
      });

      coupleLogs.forEach((log) => {
        const logTime = new Date(log.created_at).getTime();
        const subsequentFault = rawFaults.find((f) => {
          const fTime = new Date(f.created_at).getTime();
          return (
            f.relay_id == log.target_id &&
            fTime > logTime &&
            fTime - logTime < 5 * 60 * 1000
          );
        });

        if (subsequentFault) {
          patterns.push({
            type: "SHORT_CYCLE",
            severity: "critical",
            message: `Le Relais ${log.target_id} a disjoncté immédiatement (< 5min) après un recouplage par ${log.username}.`,
            timestamp: subsequentFault.created_at,
            relay_id: log.target_id,
          });
        }
      });

      // C. RECURRING CYCLE (Same hour, > 2 days)
      const recurringGroup = {};
      rawFaults.forEach((f) => {
        const date = new Date(f.created_at);
        const day = date.toDateString();
        const hour = date.getHours();
        const key = `${f.relay_id}-${hour}`;

        if (!recurringGroup[key])
          recurringGroup[key] = {
            days: new Set(),
            relayId: f.relay_id,
            hour: hour,
          };
        recurringGroup[key].days.add(day);
      });

      Object.values(recurringGroup).forEach((group) => {
        if (group.days.size > 2) {
          patterns.push({
            type: "RECURRING",
            severity: "warning",
            message: `Le Relais ${group.relayId} a disjoncté vers ${group.hour}h00 pendant ${group.days.size} jours différents.`,
            timestamp: new Date().toISOString(), // Synthetic
          });
        }
      });

      res.json({
        interventions: aggregatedInterventions,
        decoupling_stats: {
          total_decouplings: totalDecouplings,
          remote_recouplings: remoteRecouples,
          unresolved_remotely: unresolvedRemotely,
        },
        incidents_pareto: incidentsByType,
        production_trend: productionTrend,
        patterns: patterns, // <--- NEW FIELD
      });
    } catch (error) {
      console.error("[Reports] Analysis Error:", error);
      res.status(500).json({ error: "Failed to generate analysis data." });
    }
  },
);

module.exports = router;
