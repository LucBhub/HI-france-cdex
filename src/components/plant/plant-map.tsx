"use client";

import "leaflet/dist/leaflet.css";
import "leaflet-defaulticon-compatibility/dist/leaflet-defaulticon-compatibility.css";
import "leaflet-defaulticon-compatibility";

import { useEffect, useRef } from "react";
import L, { type LatLngExpression } from "leaflet";
import { type Plant } from "@/lib/data";
import { t } from "@/lib/i18n";
import { useLanguage } from "@/contexts/language-context";

interface PlantMapProps {
  plant: Plant;
}

export default function PlantMap({ plant }: PlantMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const { language } = useLanguage();

  // Get color and status for a plant
  const getPlantStatus = (plant: Plant) => {
    if (plant.status === "offline")
      return { color: "bg-gray-500", status: t("statusOffline", language) };

    let hasOpenBreaker = false;
    if (plant.relays && Array.isArray(plant.relays)) {
      // Check for strictly false OR falsy 0 (open)
      hasOpenBreaker = plant.relays.some(
        (r: any) => r.breakerStatus === false || r.breakerStatus === 0,
      );
    }

    if (hasOpenBreaker)
      return { color: "bg-red-500", status: t("statusBreakerOpen", language) };
    if (plant.status === "maintenance")
      return {
        color: "bg-yellow-500",
        status: t("statusMaintenance", language),
      };
    return { color: "bg-green-500", status: t("statusOnline", language) };
  };

  useEffect(() => {
    if (mapRef.current && !mapInstance.current && plant.gps) {
      const [lat, lng] = plant.gps.split(",").map(parseFloat);
      if (isNaN(lat) || isNaN(lng)) return;

      const plantLocation: LatLngExpression = [lat, lng];

      mapInstance.current = L.map(mapRef.current, {
        center: plantLocation,
        zoom: 13,
        scrollWheelZoom: true,
      });

      mapInstance.current.getContainer().style.zIndex = "1";

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(mapInstance.current);
    }

    // Update Marker
    if (mapInstance.current && plant.gps) {
      const [lat, lng] = plant.gps.split(",").map(parseFloat);
      if (!isNaN(lat) && !isNaN(lng)) {
        const { color } = getPlantStatus(plant);

        const customIcon = L.divIcon({
          className: "custom-marker",
          html: `<div class="w-6 h-6 rounded-full border-2 border-white shadow-md ${color} animate-pulse"></div>`,
          iconSize: [24, 24],
          iconAnchor: [12, 12],
        });

        if (markerRef.current) {
          markerRef.current.setLatLng([lat, lng]);
          markerRef.current.setIcon(customIcon);
        } else {
          markerRef.current = L.marker([lat, lng], { icon: customIcon })
            .addTo(mapInstance.current)
            .bindPopup(`<h4 class="font-bold text-base">${plant.name}</h4>`);
        }

        mapInstance.current.setView([lat, lng], 13);
      }
    }
  }, [plant]);

  // Cleanup on unmount
  useEffect(() => {
    const map = mapInstance.current;
    return () => {
      map?.remove();
      mapInstance.current = null;
    };
  }, []);

  return (
    <div ref={mapRef} className="w-full h-full min-h-[250px] rounded-lg" />
  );
}
