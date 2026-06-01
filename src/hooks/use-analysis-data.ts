import { useState, useEffect } from "react";
import { startOfDay, endOfDay, subDays } from "date-fns";

interface AnalysisDataPoint {
  time: number;
  fullDate: string;
  power?: number;
  voltage?: number;
  current?: number;
  irradiation?: number;
}

export function useAnalysisData(
  plantId: number,
  range: string,
  selectedDate: Date,
) {
  const [data, setData] = useState<AnalysisDataPoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const now = new Date();
        let start = startOfDay(now);
        let end = endOfDay(now);
        let type = "raw";

        if (range === "24h") {
          start = new Date(now.getTime() - 24 * 60 * 60 * 1000);
          end = now;
          type = "raw";
        } else if (range === "day") {
          start = startOfDay(selectedDate);
          end = endOfDay(selectedDate);
          type = "raw";
        } else if (range === "7d") {
          start = subDays(now, 7);
          type = "hourly";
        } else if (range === "30d") {
          start = subDays(now, 30);
          type = "hourly";
        }

        const token = localStorage.getItem("authToken");
        const headers = { Authorization: `Bearer ${token}` };
        // Using empty string to force relative URL for Next.js internal rewriting
        const apiUrl = "";

        const [measRes, irrRes] = await Promise.all([
          fetch(
            `${apiUrl}/api/plants/${plantId}/measurements?start=${start.toISOString()}&end=${end.toISOString()}&type=${type}`,
            { headers },
          ),
          fetch(
            `${apiUrl}/api/plants/${plantId}/irradiation?start=${start.toISOString()}&end=${end.toISOString()}`,
            { headers },
          ),
        ]);

        if (!measRes.ok || !irrRes.ok) throw new Error("Failed to fetch data");

        const measurements = await measRes.json();
        const irradiation = await irrRes.json();

        if (!isMounted) return;

        const processedData = processData(measurements, irradiation);
        setData(processedData);
      } catch (err: any) {
        if (isMounted) setError(err.message);
        console.error(err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchData();

    return () => {
      isMounted = false;
    };
  }, [plantId, range, selectedDate]);

  return { data, loading, error };
}

function processData(
  measurements: any[],
  irradiation: any[],
): AnalysisDataPoint[] {
  const dataMap = new Map<number, AnalysisDataPoint>();

  // Process measurements
  measurements.forEach((m: any) => {
    const time = new Date(m.timestamp).getTime();
    dataMap.set(time, {
      time,
      fullDate: m.timestamp,
      power: m.power_kw ?? m.avg_power_kw ?? 0,
      voltage: m.voltage_v ?? m.avg_voltage_v ?? 0,
      current: m.current_a ?? m.avg_current_a ?? 0,
    });
  });

  // Process irradiation
  irradiation.forEach((i: any) => {
    const iTime = new Date(i.timestamp).getTime();
    const existing = dataMap.get(iTime);
    if (existing) {
      existing.irradiation = i.irradiation_wh_m2;
    } else {
      dataMap.set(iTime, {
        time: iTime,
        fullDate: i.timestamp,
        irradiation: i.irradiation_wh_m2,
        power: undefined,
        voltage: undefined,
        current: undefined,
      });
    }
  });

  const merged = Array.from(dataMap.values()).sort((a, b) => a.time - b.time);

  // Interpolation Logic
  return interpolateData(merged);
}

function interpolateData(data: AnalysisDataPoint[]): AnalysisDataPoint[] {
  let lastValidIdx = -1;
  const result = [...data]; // Copy to avoid mutation issues if any

  for (let i = 0; i < result.length; i++) {
    const hasValue = result[i].power !== undefined && result[i].power !== null;

    if (hasValue) {
      if (lastValidIdx !== -1 && i > lastValidIdx + 1) {
        // Gap found
        const startVal = result[lastValidIdx].power!; // We know it exists
        const endVal = result[i].power!;
        const steps = i - lastValidIdx;
        const isSmallGap = steps <= 12;

        for (let j = lastValidIdx + 1; j < i; j++) {
          if ((result[j].irradiation || 0) > 0) {
            if (isSmallGap) {
              const progress = (j - lastValidIdx) / steps;
              result[j].power = startVal + (endVal - startVal) * progress;
            } else {
              result[j].power = 0;
            }
          }
        }
      } else if (lastValidIdx === -1 && i > 0) {
        // Start of data gap
        for (let j = 0; j < i; j++) {
          if ((result[j].irradiation || 0) > 0) {
            result[j].power = 0;
          }
        }
      }
      lastValidIdx = i;
    }
  }

  // End of data gap
  if (lastValidIdx !== -1 && lastValidIdx < result.length - 1) {
    for (let j = lastValidIdx + 1; j < result.length; j++) {
      if ((result[j].irradiation || 0) > 0) {
        result[j].power = 0;
      }
    }
  }

  return result;
}
