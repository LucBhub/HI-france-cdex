"use client";

import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { MeasurementEditor } from "./measurement-editor";
import { DeviceModelWizard } from "./device-model-wizard";
import {
  Plus,
  Edit,
  Trash2,
  Settings,
  ArrowLeft,
  AlertCircle,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { MeasurementConfig } from "@/types/measurement";
import { MEASUREMENT_TYPE_INFO } from "@/types/measurement";

interface DeviceModel {
  id: string;
  name: string;
  config: any; // Backend format
  measurements?: MeasurementConfig[]; // Our new format
  isLegacy?: boolean; // Old format flag
}

export function DeviceModelsSettings() {
  const { toast } = useToast();
  const [models, setModels] = useState<DeviceModel[]>([]);
  const [selectedModel, setSelectedModel] = useState<DeviceModel | null>(null);
  const [editingMeasurement, setEditingMeasurement] = useState<
    MeasurementConfig | undefined
  >();
  const [showEditor, setShowEditor] = useState(false);
  const [showCreateWizard, setShowCreateWizard] = useState(false);
  const [loading, setLoading] = useState(true);

  // Load models from backend
  useEffect(() => {
    fetchModels();
  }, []);

  const fetchModels = async () => {
    console.log("[DeviceModels] Fetching models...");
    try {
      const token = localStorage.getItem("authToken");
      console.log("[DeviceModels] Token:", token ? "present" : "missing");

      const url = `/api/device-models`;
      console.log("[DeviceModels] URL:", url);

      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        const formattedModels = data.map((m: any) => {
          // Check if it's a legacy model (old format with actual data)
          // A model is legacy if it has old-format measurements but no new ones
          const hasOldMeasurements =
            m.config &&
            ((m.config.nominal && Object.keys(m.config.nominal).length > 0) ||
              (m.config.measurements &&
                Object.keys(m.config.measurements).length > 0));
          const hasNewMeasurements =
            m.config?.newMeasurements && m.config.newMeasurements.length > 0;
          const isLegacy = hasOldMeasurements && !hasNewMeasurements;

          return {
            id: m.id,
            name: m.name,
            config: m.config,
            measurements: m.config?.newMeasurements || [],
            isLegacy,
          };
        });
        setModels(formattedModels);
      }
    } catch (error) {
      console.error("Error fetching models:", error);
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible de charger les profils",
      });
    } finally {
      setLoading(false);
    }
  };

  // Helper to convert new array format to old object format for backend compatibility
  const generateLegacyConfig = (measurements: MeasurementConfig[]) => {
    const legacy: any = {
      nominal: {},
      measurements: {},
      control: { couple: 0, decouple: 1 }, // Default control for now
      breakerStatus: { discrete: 0, invert: false }, // Default status
    };

    const find = (type: string) =>
      measurements.find((m) => m.measurementType === type);
    const findAll = (type: string) =>
      measurements.filter((m) => m.measurementType === type);

    // Nominal
    const inp = find("nominal");
    // Wizard sends Inp, Unp, Un as NOMINAL.
    measurements
      .filter((m) => m.measurementType === "nominal")
      .forEach((m) => {
        if (m.name.toLowerCase().includes("inp"))
          legacy.nominal.inp = {
            address: m.address,
            type: m.dataType?.toLowerCase(),
          };
        if (m.name.toLowerCase().includes("unp"))
          legacy.nominal.unp = {
            address: m.address,
            type: m.dataType?.toLowerCase(),
          };
        if (
          m.name.toLowerCase().includes("un") &&
          !m.name.toLowerCase().includes("unp")
        )
          legacy.nominal.un = {
            address: m.address,
            type: m.dataType?.toLowerCase(),
          };
      });

    // Currents (Assume generic structure: L1, L2, L3 sequential)
    const currents = findAll("current");
    if (currents.length > 0) {
      const l1 = currents[0]; // Assume sorted or first is L1
      // Check if they are sequential? For now assume standard block
      legacy.measurements.currents = {
        address: l1.address,
        length: 3,
        type: l1.dataType?.toLowerCase() || "long",
        scale: l1.scale,
        // If it's UWORD, enable spacing? Wizard doesn't explicitly set 'spacing' but backend looks for it
        // For Thytronic/Siprotec, spacing is usually handled by type
      };
    }

    // Voltages
    const voltages = findAll("voltage_pp");
    if (voltages.length > 0) {
      const u12 = voltages[0];
      legacy.measurements.voltages = {
        address: u12.address,
        length: 3,
        type: u12.dataType?.toLowerCase() || "long",
        scale: u12.scale,
      };
    }

    // Frequency
    const freq = find("frequency");
    if (freq) {
      legacy.measurements.frequency = {
        address: freq.address,
        length: 1,
        type: freq.dataType?.toLowerCase() || "long",
        scale: freq.scale,
      };
    }

    // Powers
    const powers = findAll("power");
    if (powers.length > 0) {
      const p = powers[0];
      legacy.measurements.powers = {
        address: p.address,
        length: 3, // P, Q, S
        type: p.dataType?.toLowerCase() || "long",
        scale: p.scale,
      };
    }

    return legacy;
  };

  const handleCreateModel = async (
    profileName: string,
    measurements: MeasurementConfig[],
  ) => {
    const modelId = profileName.toLowerCase().replace(/\s+/g, "-");

    try {
      const token = localStorage.getItem("authToken");
      const response = await fetch(`/api/device-models`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          id: modelId,
          name: profileName,
          config: {
            newMeasurements: measurements,
            ...generateLegacyConfig(measurements),
          },
        }),
      });

      if (response.ok) {
        toast({
          title: "Profil créé",
          description: `${profileName} a été créé avec succès avec ${measurements.length} mesures`,
        });
        setShowCreateWizard(false);
        fetchModels(); // Reload
      } else {
        const error = await response.json();
        toast({
          variant: "destructive",
          title: "Erreur",
          description: error.message || "Impossible de créer le profil",
        });
      }
    } catch (error) {
      console.error("Error creating model:", error);
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Une erreur est survenue",
      });
    }
  };

  const handleDeleteModel = async (modelId: string) => {
    if (!confirm("Supprimer ce profil ?")) return;

    try {
      const token = localStorage.getItem("authToken");
      const response = await fetch(`/api/device-models/${modelId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        toast({
          title: "Profil supprimé",
          description: "Le profil a été supprimé avec succès",
        });
        if (selectedModel?.id === modelId) {
          setSelectedModel(null);
        }
        fetchModels();
      } else {
        toast({
          variant: "destructive",
          title: "Erreur",
          description: "Impossible de supprimer le profil",
        });
      }
    } catch (error) {
      console.error("Error deleting model:", error);
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Une erreur est survenue",
      });
    }
  };

  const handleAddMeasurement = () => {
    setEditingMeasurement(undefined);
    setShowEditor(true);
  };

  const handleEditMeasurement = (measurement: MeasurementConfig) => {
    setEditingMeasurement(measurement);
    setShowEditor(true);
  };

  const handleSaveMeasurement = async (measurement: MeasurementConfig) => {
    if (!selectedModel) return;

    const updatedMeasurements = editingMeasurement
      ? selectedModel.measurements!.map((m) =>
          m.id === measurement.id ? measurement : m,
        )
      : [
          ...(selectedModel.measurements || []),
          { ...measurement, id: Date.now().toString() },
        ];

    const updatedConfig = {
      ...selectedModel.config,
      newMeasurements: updatedMeasurements,
    };

    try {
      const token = localStorage.getItem("authToken");
      const response = await fetch(`/api/device-models/${selectedModel.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: selectedModel.name,
          config: updatedConfig,
        }),
      });

      if (response.ok) {
        toast({
          title: editingMeasurement ? "Mesure mise à jour" : "Mesure ajoutée",
          description: `${measurement.name} a été ${editingMeasurement ? "mise à jour" : "ajoutée"} avec succès`,
        });
        fetchModels();
        setShowEditor(false);
        setEditingMeasurement(undefined);
      } else {
        toast({
          variant: "destructive",
          title: "Erreur",
          description: "Impossible de sauvegarder la mesure",
        });
      }
    } catch (error) {
      console.error("Error saving measurement:", error);
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Une erreur est survenue",
      });
    }
  };

  const handleDeleteMeasurement = async (id: string) => {
    if (!selectedModel || !confirm("Supprimer cette mesure ?")) return;

    const updatedMeasurements = selectedModel.measurements!.filter(
      (m) => m.id !== id,
    );
    const updatedConfig = {
      ...selectedModel.config,
      newMeasurements: updatedMeasurements,
    };

    try {
      const token = localStorage.getItem("authToken");
      const response = await fetch(`/api/device-models/${selectedModel.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: selectedModel.name,
          config: updatedConfig,
        }),
      });

      if (response.ok) {
        toast({
          title: "Mesure supprimée",
          description: "La mesure a été supprimée avec succès",
        });
        fetchModels();
      } else {
        toast({
          variant: "destructive",
          title: "Erreur",
          description: "Impossible de supprimer la mesure",
        });
      }
    } catch (error) {
      console.error("Error deleting measurement:", error);
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Une erreur est survenue",
      });
    }
  };

  // Group measurements by type
  const groupedMeasurements =
    selectedModel?.measurements?.reduce(
      (acc, m) => {
        const typeInfo = MEASUREMENT_TYPE_INFO[m.measurementType];
        const category = typeInfo?.label || "Autre";
        if (!acc[category]) acc[category] = [];
        acc[category].push(m);
        return acc;
      },
      {} as Record<string, MeasurementConfig[]>,
    ) || {};

  // If a model is selected, show its measurements
  if (selectedModel) {
    return (
      <div className="space-y-6">
        {/* Header with back button */}
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            onClick={() => {
              setSelectedModel(null);
              fetchModels(); // Refresh list
            }}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Retour aux profils
          </Button>
          <div>
            <h2 className="text-2xl font-bold">{selectedModel.name}</h2>
            <p className="text-sm text-muted-foreground">
              {selectedModel.measurements?.length || 0} mesure(s) configurée(s)
            </p>
          </div>
        </div>

        {/* Legacy warning */}
        {selectedModel.isLegacy && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Ce profil utilise l'ancien format de configuration. Vous pouvez
              ajouter de nouvelles mesures avec le nouveau système simplifié.
            </AlertDescription>
          </Alert>
        )}

        {/* Editor or List */}
        {showEditor ? (
          <MeasurementEditor
            measurement={editingMeasurement}
            relayId={1} // Dummy ID for testing
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
              <Button onClick={handleAddMeasurement}>
                <Plus className="mr-2 h-4 w-4" />
                Ajouter une Mesure
              </Button>
            </div>

            {/* Measurements List */}
            {!selectedModel.measurements ||
            selectedModel.measurements.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  <Settings className="h-12 w-12 mx-auto mb-4 opacity-20" />
                  <p>Aucune mesure configurée avec le nouveau système</p>
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
                        <CardTitle className="text-lg">{category}</CardTitle>
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
                                  {measurement.dataType} | Kv: {measurement.kv}
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
      </div>
    );
  }

  // Model list view
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Profils de Configuration</CardTitle>
              <CardDescription>
                Créez des profils de configuration Modbus réutilisables pour vos
                relays
              </CardDescription>
            </div>
            {showCreateWizard ? (
              <DeviceModelWizard
                onComplete={handleCreateModel}
                onCancel={() => setShowCreateWizard(false)}
              />
            ) : (
              <Button onClick={() => setShowCreateWizard(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Nouveau Profil
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-12 text-muted-foreground">
              Chargement...
            </div>
          ) : models.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Settings className="h-12 w-12 mx-auto mb-4 opacity-20" />
              <p>Aucun profil configuré</p>
              <p className="text-sm">
                Créez votre premier profil pour commencer
              </p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {models.map((model) => (
                <Card
                  key={model.id}
                  className="hover:bg-muted/50 transition-colors"
                >
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-base">
                          {model.name}
                        </CardTitle>
                        <CardDescription>
                          {model.measurements?.length || 0} mesure(s)
                        </CardDescription>
                      </div>
                      {model.isLegacy && (
                        <Badge variant="secondary" className="text-xs">
                          Legacy
                        </Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() => setSelectedModel(model)}
                      >
                        <Edit className="mr-2 h-4 w-4" />
                        Modifier
                      </Button>
                      {!model.isLegacy && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteModel(model.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
