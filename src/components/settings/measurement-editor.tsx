import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { TestResultModal } from "./test-result-modal";
import { useToast } from "@/hooks/use-toast";
import { FlaskConical, Save, X } from "lucide-react";
import type {
  MeasurementConfig,
  MeasurementType,
  TestResult,
} from "@/types/measurement";
import { MEASUREMENT_TYPES, MEASUREMENT_TYPE_INFO } from "@/types/measurement";

interface MeasurementEditorProps {
  measurement?: MeasurementConfig;
  relayId: number;
  relayInfo?: { ipAddress: string; port: number };
  onSave: (measurement: MeasurementConfig) => void;
  onCancel: () => void;
}

export function MeasurementEditor({
  measurement,
  relayId,
  relayInfo,
  onSave,
  onCancel,
}: MeasurementEditorProps) {
  const { toast } = useToast();
  const [config, setConfig] = useState<MeasurementConfig>(
    measurement || {
      name: "",
      measurementType: MEASUREMENT_TYPES.CURRENT,
      address: 0,
      length: 2,
      dataType: "LONG",
      endianness: "big_endian",
      kv: 16000,
      unit: "A",
    },
  );

  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [showTestResult, setShowTestResult] = useState(false);
  const [testing, setTesting] = useState(false);

  // Update defaults when measurement type changes
  useEffect(() => {
    const typeInfo = MEASUREMENT_TYPE_INFO[config.measurementType];
    if (typeInfo) {
      setConfig((prev) => ({
        ...prev,
        kv: typeInfo.defaultKv,
        dataType: typeInfo.dataTypes[0] as "UWORD" | "LONG",
        endianness: typeInfo.endianness[0] as "big_endian" | "word_swap",
        length: typeInfo.dataTypes[0] === "UWORD" ? 1 : 2,
      }));
    }
  }, [config.measurementType]);

  const handleTest = async () => {
    setTesting(true);
    try {
      const token = localStorage.getItem("authToken");
      const response = await fetch(`/api/device-models/test-read`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          relayId,
          address: config.address,
          length: config.length,
          dataType: config.dataType,
          endianness: config.endianness,
          kv: config.kv,
          measurementType: config.measurementType,
          unit: config.unit,
        }),
      });

      const result = await response.json();
      setTestResult(result);
      setShowTestResult(true);

      if (result.success && !result.error) {
        toast({
          title: "Test réussi",
          description: `Valeur: ${result.calculatedValue?.toFixed(2)} ${result.unit}`,
          variant: "default",
        });
      } else {
        toast({
          title: "Erreur de test",
          description: result.error || "Échec de la lecture Modbus",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Test error:", error);
      toast({
        title: "Erreur",
        description: "Impossible de tester la configuration",
        variant: "destructive",
      });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = () => {
    // Validation
    if (!config.name.trim()) {
      toast({
        title: "Erreur",
        description: "Le nom est requis",
        variant: "destructive",
      });
      return;
    }

    if (!config.unit.trim()) {
      toast({
        title: "Erreur",
        description: "L'unité est requise (ex: V, A, kW, Hz)",
        variant: "destructive",
      });
      return;
    }

    if (config.address < 0) {
      toast({
        title: "Erreur",
        description: "L'adresse Modbus doit être positive",
        variant: "destructive",
      });
      return;
    }

    if (config.kv <= 0) {
      toast({
        title: "Erreur",
        description: "Le Kv doit être positif",
        variant: "destructive",
      });
      return;
    }

    onSave(config);
  };

  const typeInfo = MEASUREMENT_TYPE_INFO[config.measurementType];

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>{measurement ? "Modifier" : "Nouvelle"} Mesure</CardTitle>
          <CardDescription>
            Configurez une mesure Modbus avec génération automatique de formule
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Measurement Type */}
          <div className="space-y-2">
            <Label htmlFor="measurementType">Type de Mesure</Label>
            <Select
              value={config.measurementType}
              onValueChange={(value) =>
                setConfig({
                  ...config,
                  measurementType: value as MeasurementType,
                })
              }
            >
              <SelectTrigger id="measurementType">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(MEASUREMENT_TYPE_INFO).map(([key, info]) => (
                  <SelectItem key={key} value={key}>
                    <div>
                      <div className="font-medium">{info.label}</div>
                      <div className="text-xs text-muted-foreground">
                        {info.description}
                      </div>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="name">Nom *</Label>
            <Input
              id="name"
              value={config.name}
              onChange={(e) => setConfig({ ...config, name: e.target.value })}
              placeholder="ex: Tension U12"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Address */}
            <div className="space-y-2">
              <Label htmlFor="address">Adresse Modbus *</Label>
              <Input
                id="address"
                type="number"
                value={config.address}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    address: parseInt(e.target.value) || 0,
                  })
                }
              />
            </div>

            {/* Unit */}
            <div className="space-y-2">
              <Label htmlFor="unit">Unité *</Label>
              <Input
                id="unit"
                value={config.unit}
                onChange={(e) => setConfig({ ...config, unit: e.target.value })}
                placeholder="ex: V, A, kW"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Data Type */}
            <div className="space-y-2">
              <Label htmlFor="dataType">Type de Données</Label>
              <Select
                value={config.dataType}
                onValueChange={(value) =>
                  setConfig({ ...config, dataType: value as "UWORD" | "LONG" })
                }
              >
                <SelectTrigger id="dataType">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {typeInfo?.dataTypes.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Endianness */}
            <div className="space-y-2">
              <Label htmlFor="endianness">Endianness</Label>
              <Select
                value={config.endianness}
                onValueChange={(value) =>
                  setConfig({
                    ...config,
                    endianness: value as "big_endian" | "word_swap",
                  })
                }
              >
                <SelectTrigger id="endianness">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {typeInfo?.endianness.map((end) => (
                    <SelectItem key={end} value={end}>
                      {end === "big_endian" ? "Big Endian" : "Word Swap"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Kv */}
          <div className="space-y-2">
            <Label htmlFor="kv">Kv (Facteur d'échelle)</Label>
            <Input
              id="kv"
              type="number"
              value={config.kv}
              onChange={(e) =>
                setConfig({ ...config, kv: parseInt(e.target.value) || 1 })
              }
            />
            <p className="text-xs text-muted-foreground">
              Valeur par défaut pour {typeInfo?.label}: {typeInfo?.defaultKv}
            </p>
          </div>

          {/* Formula Preview */}
          <div className="border rounded-lg p-4 bg-muted/50">
            <Label className="text-sm text-muted-foreground">
              Formule Générée Automatiquement
            </Label>
            <div className="mt-2 font-mono text-sm">
              {config.measurementType === MEASUREMENT_TYPES.NOMINAL &&
                "Valeur = raw"}
              {config.measurementType === MEASUREMENT_TYPES.CURRENT &&
                `I (${config.unit}) = (raw / ${config.kv}) × Inp`}
              {config.measurementType === MEASUREMENT_TYPES.VOLTAGE_PN &&
                `U (${config.unit}) = (raw / ${config.kv}) × Un`}
              {config.measurementType === MEASUREMENT_TYPES.VOLTAGE_PP &&
                `U (${config.unit}) = (raw / ${config.kv}) × Unp`}
              {config.measurementType === MEASUREMENT_TYPES.POWER && (
                <div className="whitespace-pre-line">
                  {`P (${config.unit}) = (raw / ${config.kv}) × Pn\nPn = √3 × Unp × Inp / 1,000,000`}
                </div>
              )}
              {config.measurementType === MEASUREMENT_TYPES.FREQUENCY &&
                `f (${config.unit}) = raw / ${config.kv}`}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-4">
            <Button onClick={handleTest} variant="outline" disabled={testing}>
              <FlaskConical className="mr-2 h-4 w-4" />
              {testing ? "Test en cours..." : "Tester"}
            </Button>
            <div className="flex-1" />
            <Button onClick={onCancel} variant="outline">
              <X className="mr-2 h-4 w-4" />
              Annuler
            </Button>
            <Button onClick={handleSave}>
              <Save className="mr-2 h-4 w-4" />
              Sauvegarder
            </Button>
          </div>
        </CardContent>
      </Card>

      <TestResultModal
        open={showTestResult}
        onOpenChange={setShowTestResult}
        result={testResult}
        relayInfo={relayInfo}
      />
    </>
  );
}
