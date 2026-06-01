"use client";

import { useState, useEffect } from "react";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { Header } from "@/components/layout/header";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MeasurementEditor } from "@/components/settings/measurement-editor";
import { Plus, Edit, Trash2, Settings } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import withAuth from "@/components/with-auth";
import type { MeasurementConfig } from "@/types/measurement";
import { MEASUREMENT_TYPE_INFO } from "@/types/measurement";

interface Relay {
  id: number;
  ipAddress: string;
  port: number;
  plantId: number;
}

interface Plant {
  id: number;
  name: string;
  relays?: Relay[];
}

function DeviceModelsPage() {
  const { toast } = useToast();
  const [plants, setPlants] = useState<Plant[]>([]);
  const [selectedRelayId, setSelectedRelayId] = useState<number | null>(null);
  const [measurements, setMeasurements] = useState<MeasurementConfig[]>([]);
  const [editingMeasurement, setEditingMeasurement] = useState<
    MeasurementConfig | undefined
  >();
  const [showEditor, setShowEditor] = useState(false);

  // Fetch plants and relays
  useEffect(() => {
    const fetchPlants = async () => {
      try {
        const token = localStorage.getItem("authToken");
        const response = await fetch(`/api/plants`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (response.ok) {
          const data = await response.json();
          setPlants(data);

          // Auto-select first relay if available
          if (data.length > 0 && data[0].relays && data[0].relays.length > 0) {
            setSelectedRelayId(data[0].relays[0].id);
          }
        }
      } catch (error) {
        console.error("Error fetching plants:", error);
      }
    };

    fetchPlants();
  }, []);

  // Get selected relay info
  const selectedRelay = plants
    .flatMap((p) => p.relays || [])
    .find((r) => r.id === selectedRelayId);

  const handleAddMeasurement = () => {
    setEditingMeasurement(undefined);
    setShowEditor(true);
  };

  const handleEditMeasurement = (measurement: MeasurementConfig) => {
    setEditingMeasurement(measurement);
    setShowEditor(true);
  };

  const handleSaveMeasurement = (measurement: MeasurementConfig) => {
    // TODO: Save to backend/database
    console.log("Saving measurement:", measurement);

    if (editingMeasurement) {
      // Update existing
      setMeasurements((prev) =>
        prev.map((m) => (m.id === measurement.id ? measurement : m)),
      );
      toast({
        title: "Mesure mise à jour",
        description: `${measurement.name} a été mise à jour avec succès`,
      });
    } else {
      // Add new
      const newMeasurement = {
        ...measurement,
        id: Date.now().toString(),
      };
      setMeasurements((prev) => [...prev, newMeasurement]);
      toast({
        title: "Mesure ajoutée",
        description: `${measurement.name} a été ajoutée avec succès`,
      });
    }

    setShowEditor(false);
    setEditingMeasurement(undefined);
  };

  const handleDeleteMeasurement = (id: string) => {
    if (!confirm("Supprimer cette mesure ?")) return;

    setMeasurements((prev) => prev.filter((m) => m.id !== id));
    toast({
      title: "Mesure supprimée",
      description: "La mesure a été supprimée avec succès",
    });
  };

  // Group measurements by type
  const groupedMeasurements = measurements.reduce(
    (acc, m) => {
      const typeInfo = MEASUREMENT_TYPE_INFO[m.measurementType];
      const category = typeInfo?.label || "Autre";
      if (!acc[category]) acc[category] = [];
      acc[category].push(m);
      return acc;
    },
    {} as Record<string, MeasurementConfig[]>,
  );

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <div className="flex flex-col h-screen bg-muted/40">
          <Header solarPlants={[] as any} />
          <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold">Device Models</h1>
                <p className="text-muted-foreground">
                  Configuration des mesures Modbus avec génération automatique
                  de formules
                </p>
              </div>
              <Settings className="h-8 w-8 text-muted-foreground" />
            </div>

            {/* Relay Selection */}
            <Card>
              <CardHeader>
                <CardTitle>Sélection du Relay</CardTitle>
                <CardDescription>
                  Choisissez le relay pour lequel configurer les mesures
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Select
                  value={selectedRelayId?.toString()}
                  onValueChange={(value) => setSelectedRelayId(parseInt(value))}
                >
                  <SelectTrigger className="w-full max-w-md">
                    <SelectValue placeholder="Sélectionner un relay" />
                  </SelectTrigger>
                  <SelectContent>
                    {plants.map((plant) =>
                      plant.relays?.map((relay) => (
                        <SelectItem key={relay.id} value={relay.id.toString()}>
                          {plant.name} - {relay.ipAddress}:{relay.port}
                        </SelectItem>
                      )),
                    )}
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>

            {/* Editor or List */}
            {showEditor ? (
              <MeasurementEditor
                measurement={editingMeasurement}
                relayId={selectedRelayId!}
                relayInfo={
                  selectedRelay
                    ? {
                        ipAddress: selectedRelay.ipAddress,
                        port: selectedRelay.port,
                      }
                    : undefined
                }
                onSave={handleSaveMeasurement}
                onCancel={() => {
                  setShowEditor(false);
                  setEditingMeasurement(undefined);
                }}
              />
            ) : (
              <>
                {/* Add Button */}
                <div className="flex justify-end">
                  <Button
                    onClick={handleAddMeasurement}
                    disabled={!selectedRelayId}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Ajouter une Mesure
                  </Button>
                </div>

                {/* Measurements List */}
                {measurements.length === 0 ? (
                  <Card>
                    <CardContent className="py-12 text-center text-muted-foreground">
                      <Settings className="h-12 w-12 mx-auto mb-4 opacity-20" />
                      <p>Aucune mesure configurée</p>
                      <p className="text-sm">
                        Cliquez sur "Ajouter une Mesure" pour commencer
                      </p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-6">
                    {Object.entries(groupedMeasurements).map(
                      ([category, items]) => (
                        <Card key={category}>
                          <CardHeader>
                            <CardTitle className="text-lg">
                              {category}
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="space-y-2">
                              {items.map((measurement) => (
                                <div
                                  key={measurement.id}
                                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50"
                                >
                                  <div className="flex-1">
                                    <div className="font-medium">
                                      {measurement.name}
                                    </div>
                                    <div className="text-sm text-muted-foreground font-mono">
                                      Address: {measurement.address} |{" "}
                                      {measurement.dataType} | Kv:{" "}
                                      {measurement.kv}
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <Badge variant="outline">
                                      {measurement.unit}
                                    </Badge>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() =>
                                        handleEditMeasurement(measurement)
                                      }
                                    >
                                      <Edit className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() =>
                                        handleDeleteMeasurement(measurement.id!)
                                      }
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </CardContent>
                        </Card>
                      ),
                    )}
                  </div>
                )}
              </>
            )}
          </main>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

export default withAuth(DeviceModelsPage, ["admin", "superadmin"]);
