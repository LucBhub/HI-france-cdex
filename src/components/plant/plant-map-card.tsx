"use client";

import dynamic from "next/dynamic";
import { Card } from "@/components/ui/card";
import { type Plant } from "@/lib/data";

interface PlantMapCardProps {
  plant: Plant;
}

// Dynamically import the map component to avoid SSR issues with Leaflet.
// This is a common pattern for client-side only libraries.
const PlantMap = dynamic(() => import("@/components/plant/plant-map"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full min-h-[250px] bg-muted animate-pulse rounded-lg" />
  ),
});

export function PlantMapCard({ plant }: PlantMapCardProps) {
  return (
    <Card className="w-full h-full overflow-hidden">
      <PlantMap plant={plant} />
    </Card>
  );
}
