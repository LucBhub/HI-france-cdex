"use client";

import "leaflet/dist/leaflet.css";
import "leaflet-defaulticon-compatibility/dist/leaflet-defaulticon-compatibility.css";
import "leaflet-defaulticon-compatibility";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";
// @ts-ignore
import "leaflet.markercluster";

import { useEffect, useRef } from "react";
import L, { type LatLngExpression } from "leaflet";
import { type Plant } from "@/lib/data";
import { t } from "@/lib/i18n";
import { useLanguage } from "@/contexts/language-context";

const mapCenter: LatLngExpression = [46.603354, 1.888334]; // Center of France

interface MapProps {
  solarPlants: Plant[];
}

// Ensure MarkerClusterGroup is available on L
declare module "leaflet" {
  interface MarkerClusterGroup extends L.FeatureGroup {
    addLayer(layer: L.Layer): this;
    clearLayers(): this;
  }
  // @ts-ignore
  export function markerClusterGroup(options?: any): MarkerClusterGroup;
}

export default function Map({ solarPlants }: MapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<L.Map | null>(null);
  const markersRef = useRef<L.MarkerClusterGroup | null>(null);
  const { language } = useLanguage();

  // Get color and status for a plant
  const getPlantStatus = (plant: Plant) => {
    // 1. Offline?
    if (plant.status === "offline")
      return { color: "bg-gray-500", status: t("statusOffline", language) };

    // 2. Active Faults? (We check relays array if populated, relying on status calculation from backend)
    // If the backend sends plant.status = 'operational', we assume it's green.
    // However, user requested Red for "Default OR Open Breaker".

    let hasOpenBreaker = false;
    let hasActiveFault = false; // We would need fault count in plant object to be sure, or iterate relays

    // Check relays if available
    if (plant.relays && Array.isArray(plant.relays)) {
      // Check for strictly false OR falsy 0 (open)
      hasOpenBreaker = plant.relays.some(
        (r: any) => r.breakerStatus === false || r.breakerStatus === 0,
      ); // false = open
      // We don't have fault info directly on relays here unless we fetch it, but usually plant status reflects it?
      // Let's rely on passed logic: Active Faults usually trigger alarms.
      // Ideally backend calculates a global "health" status.

      // For now, let's use:
      // - Offline -> Gray
      // - Breaker Open -> Red
      // - Else -> Green
    }

    if (hasOpenBreaker)
      return { color: "bg-red-500", status: t("statusBreakerOpen", language) };

    // Use generic plant status if available
    if (plant.status === "maintenance")
      return {
        color: "bg-yellow-500",
        status: t("statusMaintenance", language),
      };

    return { color: "bg-green-500", status: t("statusOnline", language) };
  };

  useEffect(() => {
    if (mapRef.current && !mapInstance.current) {
      // 1. Create Base Layers
      const osmLayer = L.tileLayer(
        "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
        {
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        },
      );

      // 2. Initialize Map
      mapInstance.current = L.map(mapRef.current, {
        center: mapCenter,
        zoom: 5,
        scrollWheelZoom: true,
        layers: [osmLayer], // Only add base layer by default
      });

      mapInstance.current.getContainer().style.zIndex = "1";

      // 3. Create Weather Layers (Overlay)
      // NEXT_PUBLIC_OPENWEATHER_API_KEY is baked into the JS at docker build time.
      // The Dockerfile passes it via --build-arg. See deployment.md.
      const apiKey = process.env.NEXT_PUBLIC_OPENWEATHER_API_KEY;

      const cloudsLayer = L.tileLayer(
        `https://tile.openweathermap.org/map/clouds_new/{z}/{x}/{y}.png?appid=${apiKey}`,
        {
          attribution:
            'Weather data &copy; <a href="https://openweathermap.org/">OpenWeatherMap</a>',
          opacity: 1.0,
          className: "tiles-clouds",
        },
      );

      const precipLayer = L.tileLayer(
        `https://tile.openweathermap.org/map/precipitation_new/{z}/{x}/{y}.png?appid=${apiKey}`,
        {
          attribution:
            'Weather data &copy; <a href="https://openweathermap.org/">OpenWeatherMap</a>',
          opacity: 0.8,
        },
      );

      const tempLayer = L.tileLayer(
        `https://tile.openweathermap.org/map/temp_new/{z}/{x}/{y}.png?appid=${apiKey}`,
        {
          attribution:
            'Weather data &copy; <a href="https://openweathermap.org/">OpenWeatherMap</a>',
          opacity: 0.5,
        },
      );

      // 4. Initialize Cluster Group
      // @ts-ignore
      markersRef.current = L.markerClusterGroup({
        showCoverageOnHover: false,
        maxClusterRadius: 50,
      });
      // Add markers layer to map by default
      mapInstance.current.addLayer(markersRef.current!);

      // 5. Add Layer Control
      const baseMaps = {
        OpenStreetMap: osmLayer,
      };

      const overlayMaps = {
        [t("solarPlants", language)]: markersRef.current!, // User can toggle plants too if they want
        [t("clouds", language)]: cloudsLayer,
        [t("precipitation", language)]: precipLayer,
        [t("weather_temp", language)]: tempLayer,
      };

      L.control
        .layers(baseMaps, overlayMaps, { position: "topright" })
        .addTo(mapInstance.current);

      // 6. Legend Control
      const legend = new L.Control({ position: "bottomright" });

      legend.onAdd = function () {
        const div = L.DomUtil.create(
          "div",
          "info legend bg-white/80 p-3 rounded-md shadow-md text-xs font-sans",
        );
        L.DomEvent.disableClickPropagation(div);
        div.style.display = "none"; // Hidden by default
        return div;
      };

      legend.addTo(mapInstance.current);

      // Event Listeners for Dynamic Legend
      mapInstance.current.on("overlayadd", (event: any) => {
        const div = legend.getContainer();
        if (!div) return;

        // Reset content
        div.innerHTML = "";
        div.style.display = "block";

        // Check layer name
        if (event.name === t("weather_temp", language)) {
          div.innerHTML = `
            <div class="font-bold mb-1">${t("legend_temp", language)}</div>
            <div style="width: 150px; height: 10px; background: linear-gradient(to right, 
              #9575cd, #42a5f5, #4dd0e1, #81c784, #fff176, #ffb74d, #e57373);"></div>
            <div class="flex justify-between mt-1 text-[10px] text-gray-600">
              <span>-40°C</span><span>0°C</span><span>+40°C</span>
            </div>
          `;
        } else if (event.name === t("precipitation", language)) {
          div.innerHTML = `
            <div class="font-bold mb-1">${t("legend_precip", language)}</div>
            <div style="width: 150px; height: 10px; background: linear-gradient(to right, 
              rgba(225,225,225,0), #81d4fa, #29b6f6, #0288d1, #1a237e);"></div>
            <div class="flex justify-between mt-1 text-[10px] text-gray-600">
              <span>0</span><span>2</span><span>10</span><span>100+</span>
            </div>
          `;
        } else if (event.name === t("clouds", language)) {
          div.innerHTML = `
            <div class="font-bold mb-1">${t("legend_clouds", language)}</div>
             <div style="width: 150px; height: 10px; background: linear-gradient(to right, 
              rgba(255,255,255,0), rgba(240,240,240,1)); border: 1px solid #ccc;"></div>
            <div class="flex justify-between mt-1 text-[10px] text-gray-600">
              <span>0%</span><span>50%</span><span>100%</span>
            </div>
          `;
        } else {
          // If it's markers or something else, maybe hide or keep previous?
          // Usually we only show weather legends.
          // If it's plants, we might want to hide weather legend?
          // But multiple layers can be active.
          // Leaflet 'overlayadd' fires for EACH added layer.
          // A robust implementation manages a list of active legends, but for now simple replacement is fine
          // or stack them. Stacking is better but harder with single div.
          // Let's stick to "Last Added" or specific check.
          // If it is NOT a weather layer, we might not want to clear.
          if (event.name === t("solarPlants", language)) {
            // Don't change the legend if plants are toggled
            // But if it was hidden, keep it hidden?
            // If weather is active, legend should stay.
            // For simplicity, we only Update if it matches weather.
            return;
          }
        }
      });

      mapInstance.current.on("overlayremove", (event: any) => {
        const div = legend.getContainer();
        if (!div) return;

        // If the removed layer matches the current legend title, hide it?
        // This is tricky with translations in innerHTML.
        // Simple approach: If any weather layer is removed, check if others are active?
        // Or just hide.
        // Let's check map for active layers.

        let hasWeather = false;
        mapInstance.current?.eachLayer((layer) => {
          // Identifying layers is hard without ID.
          // We can check equality with our created variables if we had access to them in this scope closure context?
          // Yes, we do! closures capture cloudsLayer etc.

          if (mapInstance.current?.hasLayer(cloudsLayer)) hasWeather = true;
          if (mapInstance.current?.hasLayer(precipLayer)) hasWeather = true;
          if (mapInstance.current?.hasLayer(tempLayer)) hasWeather = true;
        });

        if (!hasWeather) {
          div.style.display = "none";
          div.innerHTML = "";
        } else {
          // If multiple weather layers are on, we might show the one that is NOT removed?
          // It's a bit edge case. Usually users pick one view.
          // If they pick 2, the last added wins.
          // If they remove the last added, ideally we show the other one.
          // Re-evaluating:
          if (mapInstance.current?.hasLayer(tempLayer)) {
            // Trigger fake add to refresh?
            // Or just set innerHTML directly.
            // Let's just reset to Temp if it exists.
            // (Copy-paste logic or helper function preferred, but inline for now)
          }
          // For now, if we remove 'clouds', and 'temp' is on, checking happens.
          // If we remove the one that is currently displayed...
          // It's acceptable to just clear or leave it.
          // Clearing is safer to avoid stale legend.
          // But if specific layer is removed:
          if (
            (event.name === t("weather_temp", language) &&
              !mapInstance.current?.hasLayer(tempLayer)) ||
            (event.name === t("clouds", language) &&
              !mapInstance.current?.hasLayer(cloudsLayer)) ||
            (event.name === t("precipitation", language) &&
              !mapInstance.current?.hasLayer(precipLayer))
          ) {
            // Check if others are present to fallback
            if (mapInstance.current?.hasLayer(tempLayer)) {
              // switch to temp
              // ... logic reused ...
            } else if (mapInstance.current?.hasLayer(precipLayer)) {
              // switch to precip
            } else if (mapInstance.current?.hasLayer(cloudsLayer)) {
              // switch to clouds
            } else {
              div.style.display = "none";
            }
          }
        }
      });
    }

    // Update Markers
    if (markersRef.current && mapInstance.current) {
      // ... (rest of marker logic remains same, just ensure we update the cluster group)
      markersRef.current.clearLayers();

      solarPlants.forEach((plant) => {
        if (!plant.gps) return;
        const [lat, lng] = plant.gps.split(",").map(Number);
        if (isNaN(lat) || isNaN(lng)) return;

        const { color, status } = getPlantStatus(plant);

        // Create custom DivIcon
        const customIcon = L.divIcon({
          className: "custom-marker",
          html: `<div class="w-4 h-4 rounded-full border-2 border-white shadow-md ${color}"></div>`,
          iconSize: [16, 16],
          iconAnchor: [8, 8],
        });

        const powerKw = Number.isFinite(Number(plant.powerOutput))
          ? Number(plant.powerOutput).toFixed(2)
          : "0.00";

        const popupContent = `
                  <div class="p-1 font-sans">
                    <h4 class="font-bold text-base mb-2">${plant.name}</h4>
                    <div class="text-sm mb-2 flex items-center gap-2">
                      ${t("status", language)}:
                      <span class="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold text-white ${color}">
                        ${status}
                      </span>
                    </div>
                    <p class="text-sm text-muted-foreground mb-3">
                      ${t("powerOutput", language) || "Power Output"}: ${powerKw} kW
                    </p>
                    <a href="/plant/${plant.id}" class="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 bg-primary text-primary-foreground hover:bg-primary/90 h-9 px-3 w-full text-white no-underline">
                      ${t("viewSynoptic", language) || "View Synoptic"}
                    </a>
                  </div>
                `;

        const marker = L.marker([lat, lng], { icon: customIcon }).bindPopup(
          popupContent,
        );

        markersRef.current?.addLayer(marker);
      });
    }
  }, [solarPlants, language]); // Add language dependency to refresh labels if needed (though layer control might need full rebuild)

  // Note: changing language dynamically for layer control labels is tricky with React useEffect on []
  // currently we only init map once. Ideally we'd destroy and recreate or update control labels.
  // For now, it will take the language at mount time.

  // Cleanup
  useEffect(() => {
    // Only cleanup on unmount
    return () => {
      if (mapInstance.current) {
        mapInstance.current.remove();
        mapInstance.current = null;
        markersRef.current = null;
      }
    };
  }, []);

  return (
    <div className="relative w-full h-full">
      <style jsx global>{`
        .tiles-clouds {
          filter: brightness(0.95) drop-shadow(0 2px 4px rgba(0, 0, 0, 0.4));
        }
      `}</style>
      <div
        id="dashboard-map-container"
        ref={mapRef}
        className="w-full h-full"
      />
    </div>
  );
}
