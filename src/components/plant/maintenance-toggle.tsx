"use client";

import { useState } from "react";
import { type Plant } from "@/lib/data";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";

interface MaintenanceToggleProps {
  plant: Plant;
}

export function MaintenanceToggle({ plant }: MaintenanceToggleProps) {
  const [isMaintenance, setIsMaintenance] = useState(
    plant.status === "maintenance",
  );
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleToggle = async (checked: boolean) => {
    setIsLoading(true);
    const newStatus = checked ? "maintenance" : "operational";

    try {
      const token = localStorage.getItem("authToken");
      const response = await fetch(`/api/plants/${plant.id}/status`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: newStatus }),
      });

      if (response.ok) {
        setIsMaintenance(checked);
        toast({
          title: "Statut mis à jour",
          description: `La centrale est maintenant ${checked ? "en maintenance" : "opérationnelle"}.`,
        });
      } else {
        throw new Error("Failed to update status");
      }
    } catch (error) {
      console.error(error);
      toast({
        title: "Erreur",
        description: "Impossible de modifier le statut.",
        variant: "destructive",
      });
      // Revert Switch state visually if needed, but state handles it
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex items-center space-x-2 border p-2 rounded-lg bg-card text-card-foreground shadow-sm">
      <div className="flex-1">
        <Label htmlFor="maintenance-mode" className="font-semibold block">
          Mode Maintenance
        </Label>
        <p className="text-xs text-muted-foreground">
          {isMaintenance
            ? "Centrale indisponible (Jaune)"
            : "Fonctionnement normal"}
        </p>
      </div>
      {isLoading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Switch
          id="maintenance-mode"
          checked={isMaintenance}
          onCheckedChange={handleToggle}
          className={`${isMaintenance ? "bg-yellow-500" : ""}`}
        />
      )}
    </div>
  );
}
