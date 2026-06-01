"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Sun, ChevronDown } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { type Plant } from "@/lib/data";

export function SynopticSelector({ solarPlants }: { solarPlants: Plant[] }) {
  const router = useRouter();

  const handleSelect = (plantId: number) => {
    router.push(`/plant/${plantId}`);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline">
          Synoptic
          <ChevronDown className="ml-2 h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {solarPlants.length > 0 ? (
          solarPlants.map((plant) => (
            <DropdownMenuItem
              key={plant.id}
              onSelect={() => handleSelect(plant.id)}
            >
              <Sun className="mr-2 h-4 w-4" />
              <span>{plant.name}</span>
            </DropdownMenuItem>
          ))
        ) : (
          <DropdownMenuItem disabled>No plants available</DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
