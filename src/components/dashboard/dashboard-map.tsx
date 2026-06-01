"use client";

import dynamic from "next/dynamic";
import { Card } from "@/components/ui/card";
import { type Plant } from "@/lib/data";

interface DashboardMapProps {
  solarPlants: Plant[];
}

// Use dynamic import for the map component to prevent SSR issues
const Map = dynamic(() => import("@/components/dashboard/map"), {
  ssr: false,
  loading: () => <div className="w-full h-full bg-muted animate-pulse" />,
});

export function DashboardMap({ solarPlants }: DashboardMapProps) {
  return (
    <Card className="w-full h-full overflow-hidden">
      <Map solarPlants={solarPlants} />
    </Card>
  );
}
