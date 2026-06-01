import { useState } from "react";
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
import { Progress } from "@/components/ui/progress";
import { ChevronLeft, ChevronRight, Check } from "lucide-react";
import type { MeasurementConfig } from "@/types/measurement";
import { MEASUREMENT_TYPES } from "@/types/measurement";

interface MeasurementFormData {
  name: string;
  address: number;
  dataType: "UWORD" | "LONG" | "INT16";
  endianness: "big_endian" | "word_swap";
  kv: number;
  unit: string;
  scale?: number;
}

interface WizardData {
  profileName: string;
  inp: MeasurementFormData;
  unp: MeasurementFormData;
  un: MeasurementFormData;
  currentL1: MeasurementFormData;
  currentL2: MeasurementFormData;
  currentL3: MeasurementFormData;
  voltageU12: MeasurementFormData;
  voltageU23: MeasurementFormData;
  voltageU31: MeasurementFormData;
  powerP: MeasurementFormData;
  powerQ: MeasurementFormData;
  powerS: MeasurementFormData;
  frequency: MeasurementFormData;
}
interface DeviceModelWizardProps {
  onComplete: (profileName: string, measurements: MeasurementConfig[]) => void;
  onCancel: () => void;
}

const TEMPLATES = {
  thytronic: {
    name: "Thytronic XMR-A (Standard)",
    data: {
      inp: {
        name: "Inp",
        address: 77,
        dataType: "LONG",
        endianness: "big_endian",
        kv: 100,
        unit: "A",
      },
      unp: {
        name: "Unp",
        address: 85,
        dataType: "LONG",
        endianness: "big_endian",
        kv: 100,
        unit: "V",
      },
      un: {
        name: "Un",
        address: 0,
        dataType: "LONG",
        endianness: "big_endian",
        kv: 100,
        unit: "V",
      },
      currentL1: {
        name: "Courant L1",
        address: 390,
        dataType: "LONG",
        endianness: "big_endian",
        kv: 16000,
        unit: "A",
      },
      currentL2: {
        name: "Courant L2",
        address: 394,
        dataType: "LONG",
        endianness: "big_endian",
        kv: 16000,
        unit: "A",
      },
      currentL3: {
        name: "Courant L3",
        address: 398,
        dataType: "LONG",
        endianness: "big_endian",
        kv: 16000,
        unit: "A",
      },
      voltageU12: {
        name: "Tension U12",
        address: 408,
        dataType: "LONG",
        endianness: "word_swap",
        kv: 112000,
        unit: "V",
      },
      voltageU23: {
        name: "Tension U23",
        address: 412,
        dataType: "LONG",
        endianness: "word_swap",
        kv: 112000,
        unit: "V",
      },
      voltageU31: {
        name: "Tension U31",
        address: 416,
        dataType: "LONG",
        endianness: "word_swap",
        kv: 112000,
        unit: "V",
      },
      powerP: {
        name: "Puissance Active",
        address: 478,
        dataType: "LONG",
        endianness: "big_endian",
        kv: 3000000,
        unit: "kW",
      },
      powerQ: {
        name: "Puissance Réactive",
        address: 482,
        dataType: "LONG",
        endianness: "big_endian",
        kv: 3000000,
        unit: "kVAR",
      },
      powerS: {
        name: "Puissance Apparente",
        address: 486,
        dataType: "LONG",
        endianness: "big_endian",
        kv: 3000000,
        unit: "kVA",
      },
      frequency: {
        name: "Fréquence",
        address: 442,
        dataType: "LONG",
        endianness: "word_swap",
        kv: 1000,
        unit: "Hz",
      },
    },
  },
  siprotec: {
    name: "Siemens Siprotec 7SJ80",
    data: {
      inp: {
        name: "Inp",
        address: 0,
        dataType: "INT16",
        endianness: "big_endian",
        kv: 1,
        unit: "A",
      }, // Not used same way
      unp: {
        name: "Unp",
        address: 0,
        dataType: "INT16",
        endianness: "big_endian",
        kv: 1,
        unit: "V",
      },
      un: {
        name: "Un",
        address: 0,
        dataType: "INT16",
        endianness: "big_endian",
        kv: 1,
        unit: "V",
      },
      // Siprotec Addresses (based on migration)
      currentL1: {
        name: "Courant L1",
        address: 30001,
        dataType: "INT16",
        endianness: "big_endian",
        kv: 1,
        scale: 0.1,
        unit: "A",
      },
      currentL2: {
        name: "Courant L2",
        address: 30002,
        dataType: "INT16",
        endianness: "big_endian",
        kv: 1,
        scale: 0.1,
        unit: "A",
      },
      currentL3: {
        name: "Courant L3",
        address: 30003,
        dataType: "INT16",
        endianness: "big_endian",
        kv: 1,
        scale: 0.1,
        unit: "A",
      },
      voltageU12: {
        name: "Tension U12",
        address: 30005,
        dataType: "INT16",
        endianness: "big_endian",
        kv: 1,
        scale: 10,
        unit: "V",
      },
      voltageU23: {
        name: "Tension U23",
        address: 30006,
        dataType: "INT16",
        endianness: "big_endian",
        kv: 1,
        scale: 10,
        unit: "V",
      },
      voltageU31: {
        name: "Tension U31",
        address: 30007,
        dataType: "INT16",
        endianness: "big_endian",
        kv: 1,
        scale: 10,
        unit: "V",
      },
      powerP: {
        name: "Puissance Active",
        address: 30012,
        dataType: "INT16",
        endianness: "big_endian",
        kv: 1,
        scale: 10,
        unit: "kW",
      },
      powerQ: {
        name: "Puissance Réactive",
        address: 30013,
        dataType: "INT16",
        endianness: "big_endian",
        kv: 1,
        scale: 10,
        unit: "kVAR",
      },
      powerS: {
        name: "Puissance Apparente",
        address: 30014,
        dataType: "INT16",
        endianness: "big_endian",
        kv: 1,
        scale: 10,
        unit: "kVA",
      },
      frequency: {
        name: "Fréquence",
        address: 30015,
        dataType: "INT16",
        endianness: "big_endian",
        kv: 1,
        scale: 0.01,
        unit: "Hz",
      },
    },
  },
};

const STEPS = [
  { id: 1, title: "Nom du Profil", description: "Identifiez votre profil" },
  { id: 2, title: "Valeurs Nominales", description: "Inp, Unp, Un" },
  { id: 3, title: "Courants", description: "L1, L2, L3" },
  { id: 4, title: "Tensions", description: "U12, U23, U31" },
  { id: 5, title: "Puissance", description: "P, Q, S" },
  { id: 6, title: "Fréquence", description: "f" },
  { id: 7, title: "Résumé", description: "Vérification finale" },
];

export function DeviceModelWizard({
  onComplete,
  onCancel,
}: DeviceModelWizardProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [data, setData] = useState<WizardData>({
    profileName: "",
    inp: {
      name: "Inp",
      address: 77,
      dataType: "LONG",
      endianness: "big_endian",
      kv: 100,
      unit: "A",
    },
    unp: {
      name: "Unp",
      address: 85,
      dataType: "LONG",
      endianness: "big_endian",
      kv: 100,
      unit: "V",
    },
    un: {
      name: "Un",
      address: 0,
      dataType: "LONG",
      endianness: "big_endian",
      kv: 100,
      unit: "V",
    },
    currentL1: {
      name: "Courant L1",
      address: 390,
      dataType: "LONG",
      endianness: "big_endian",
      kv: 16000,
      unit: "A",
    },
    currentL2: {
      name: "Courant L2",
      address: 394,
      dataType: "LONG",
      endianness: "big_endian",
      kv: 16000,
      unit: "A",
    },
    currentL3: {
      name: "Courant L3",
      address: 398,
      dataType: "LONG",
      endianness: "big_endian",
      kv: 16000,
      unit: "A",
    },
    voltageU12: {
      name: "Tension U12",
      address: 408,
      dataType: "LONG",
      endianness: "word_swap",
      kv: 112000,
      unit: "V",
    },
    voltageU23: {
      name: "Tension U23",
      address: 412,
      dataType: "LONG",
      endianness: "word_swap",
      kv: 112000,
      unit: "V",
    },
    voltageU31: {
      name: "Tension U31",
      address: 416,
      dataType: "LONG",
      endianness: "word_swap",
      kv: 112000,
      unit: "V",
    },
    powerP: {
      name: "Puissance Active",
      address: 478,
      dataType: "LONG",
      endianness: "big_endian",
      kv: 3000000,
      unit: "kW",
    },
    powerQ: {
      name: "Puissance Réactive",
      address: 482,
      dataType: "LONG",
      endianness: "big_endian",
      kv: 3000000,
      unit: "kVAR",
    },
    powerS: {
      name: "Puissance Apparente",
      address: 486,
      dataType: "LONG",
      endianness: "big_endian",
      kv: 3000000,
      unit: "kVA",
    },
    frequency: {
      name: "Fréquence",
      address: 442,
      dataType: "LONG",
      endianness: "word_swap",
      kv: 1000,
      unit: "Hz",
    },
  });

  // Add template application logic
  const applyTemplate = (templateKey: string) => {
    const tpl = TEMPLATES[templateKey as keyof typeof TEMPLATES];
    if (tpl) {
      setData((prev) => ({
        ...prev,
        ...(tpl.data as any), // Cast to avoid strict type issues with Partial
        profileName: prev.profileName || tpl.name,
      }));
    }
  };

  const updateField = (field: keyof WizardData, value: any) => {
    setData((prev) => ({ ...prev, [field]: value }));
  };

  const updateMeasurement = (
    key: keyof WizardData,
    updates: Partial<MeasurementFormData>,
  ) => {
    setData((prev) => ({
      ...prev,
      [key]: { ...(prev[key] as MeasurementFormData), ...updates },
    }));
  };

  const canProceed = () => {
    switch (currentStep) {
      case 1:
        return data.profileName.trim().length > 0;
      case 2:
        return data.inp.address >= 0 && data.unp.address >= 0;
      case 3:
        return (
          data.currentL1.address >= 0 &&
          data.currentL2.address >= 0 &&
          data.currentL3.address >= 0
        );
      case 4:
        return (
          data.voltageU12.address >= 0 &&
          data.voltageU23.address >= 0 &&
          data.voltageU31.address >= 0
        );
      case 5:
        return data.powerP.address >= 0;
      case 6:
        return data.frequency.address >= 0;
      default:
        return true;
    }
  };

  const handleComplete = () => {
    const measurements: MeasurementConfig[] = [
      { ...data.inp, measurementType: MEASUREMENT_TYPES.NOMINAL, length: 2 },
      { ...data.unp, measurementType: MEASUREMENT_TYPES.NOMINAL, length: 2 },
      ...(data.un.address > 0
        ? [
            {
              ...data.un,
              measurementType: MEASUREMENT_TYPES.NOMINAL,
              length: 2,
            },
          ]
        : []),
      {
        ...data.currentL1,
        measurementType: MEASUREMENT_TYPES.CURRENT,
        length: data.currentL1.dataType === "LONG" ? 2 : 1,
      },
      {
        ...data.currentL2,
        measurementType: MEASUREMENT_TYPES.CURRENT,
        length: data.currentL2.dataType === "LONG" ? 2 : 1,
      },
      {
        ...data.currentL3,
        measurementType: MEASUREMENT_TYPES.CURRENT,
        length: data.currentL3.dataType === "LONG" ? 2 : 1,
      },
      {
        ...data.voltageU12,
        measurementType: MEASUREMENT_TYPES.VOLTAGE_PP,
        length: data.voltageU12.dataType === "LONG" ? 2 : 1,
      },
      {
        ...data.voltageU23,
        measurementType: MEASUREMENT_TYPES.VOLTAGE_PP,
        length: data.voltageU23.dataType === "LONG" ? 2 : 1,
      },
      {
        ...data.voltageU31,
        measurementType: MEASUREMENT_TYPES.VOLTAGE_PP,
        length: data.voltageU31.dataType === "LONG" ? 2 : 1,
      },
      {
        ...data.powerP,
        measurementType: MEASUREMENT_TYPES.POWER,
        length: data.powerP.dataType === "LONG" ? 2 : 1,
      },
      ...(data.powerQ.address > 0
        ? [
            {
              ...data.powerQ,
              measurementType: MEASUREMENT_TYPES.POWER,
              length: data.powerQ.dataType === "LONG" ? 2 : 1,
            },
          ]
        : []),
      ...(data.powerS.address > 0
        ? [
            {
              ...data.powerS,
              measurementType: MEASUREMENT_TYPES.POWER,
              length: data.powerS.dataType === "LONG" ? 2 : 1,
            },
          ]
        : []),
      {
        ...data.frequency,
        measurementType: MEASUREMENT_TYPES.FREQUENCY,
        length: data.frequency.dataType === "LONG" ? 2 : 1,
      },
    ];

    onComplete(data.profileName, measurements);
  };

  const renderMeasurementFields = (
    key: keyof WizardData,
    label: string,
    required: boolean = true,
  ) => {
    const measurement = data[key] as MeasurementFormData;

    return (
      <div className="space-y-4 p-4 border rounded-lg">
        <h4 className="font-medium">
          {label} {required && <span className="text-red-500">*</span>}
        </h4>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Nom</Label>
            <Input
              value={measurement.name}
              onChange={(e) => updateMeasurement(key, { name: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>Adresse Modbus {required && "*"}</Label>
            <Input
              type="number"
              value={measurement.address}
              onChange={(e) =>
                updateMeasurement(key, {
                  address: parseInt(e.target.value) || 0,
                })
              }
            />
          </div>
          <div className="space-y-2">
            <Label>Type de Données</Label>
            <Select
              value={measurement.dataType}
              onValueChange={(value) =>
                updateMeasurement(key, { dataType: value as "UWORD" | "LONG" })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="UWORD">UWORD (16-bit)</SelectItem>
                <SelectItem value="LONG">LONG (32-bit)</SelectItem>
                <SelectItem value="INT16">INT16 (Signed 16-bit)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Endianness</Label>
            <Select
              value={measurement.endianness}
              onValueChange={(value) =>
                updateMeasurement(key, {
                  endianness: value as "big_endian" | "word_swap",
                })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="big_endian">Big Endian</SelectItem>
                <SelectItem value="word_swap">Word Swap</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Kv (Facteur d'échelle)</Label>
            <Input
              type="number"
              value={measurement.kv}
              onChange={(e) =>
                updateMeasurement(key, { kv: parseInt(e.target.value) || 1 })
              }
            />
          </div>
          <div className="space-y-2">
            <Label>Unité</Label>
            <Input
              value={measurement.unit}
              onChange={(e) => updateMeasurement(key, { unit: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label>Scale (Facteur Direct)</Label>
            <Input
              type="number"
              step="0.001"
              value={measurement.scale ?? ""}
              onChange={(e) =>
                updateMeasurement(key, {
                  scale: e.target.value
                    ? parseFloat(e.target.value)
                    : undefined,
                })
              }
              placeholder="ex: 0.1 (Optionnel)"
            />
            <p className="text-[10px] text-muted-foreground">
              Si défini, remplace le calcul Kv
            </p>
          </div>
          <p className="text-[10px] text-muted-foreground">
            Si défini, remplace le calcul Kv
          </p>
        </div>
      </div>
    );
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="profileName">Nom du Profil *</Label>
              <Input
                id="profileName"
                value={data.profileName}
                onChange={(e) => updateField("profileName", e.target.value)}
                placeholder="ex: Thytronic XMR-A Custom"
              />
              <p className="text-sm text-muted-foreground">
                Ce nom identifiera votre profil de configuration Modbus
              </p>
            </div>

            <div className="space-y-2 pt-4 border-t">
              <Label>Modèle (Template)</Label>
              <Select onValueChange={applyTemplate}>
                <SelectTrigger>
                  <SelectValue placeholder="Choisir un modèle de base..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="thytronic">Thytronic XMR-A</SelectItem>
                  <SelectItem value="siprotec">
                    Siemens Siprotec 7SJ80
                  </SelectItem>
                </SelectContent>
              </Select>
              <p className="text-sm text-muted-foreground">
                Sélectionner un modèle remplira automatiquement les champs avec
                les valeurs par défaut
              </p>
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Les valeurs nominales sont utilisées comme références dans les
              formules de calcul
            </p>
            {renderMeasurementFields("inp", "Inp - Courant Nominal Primaire")}
            {renderMeasurementFields(
              "unp",
              "Unp - Tension Nominale Primaire (Phase-Phase)",
            )}
            {renderMeasurementFields(
              "un",
              "Un - Tension Nominale (Phase-Neutre)",
              false,
            )}
          </div>
        );

      case 3:
        return (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Configurez les mesures de courant pour les trois phases
            </p>
            {renderMeasurementFields("currentL1", "Courant L1")}
            {renderMeasurementFields("currentL2", "Courant L2")}
            {renderMeasurementFields("currentL3", "Courant L3")}
          </div>
        );

      case 4:
        return (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Configurez les tensions composées (phase-phase)
            </p>
            {renderMeasurementFields("voltageU12", "Tension U12")}
            {renderMeasurementFields("voltageU23", "Tension U23")}
            {renderMeasurementFields("voltageU31", "Tension U31")}
          </div>
        );

      case 5:
        return (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Configurez les mesures de puissance
            </p>
            {renderMeasurementFields("powerP", "Puissance Active (P)")}
            {renderMeasurementFields("powerQ", "Puissance Réactive (Q)", false)}
            {renderMeasurementFields(
              "powerS",
              "Puissance Apparente (S)",
              false,
            )}
          </div>
        );

      case 6:
        return (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Configurez la mesure de fréquence du réseau
            </p>
            {renderMeasurementFields("frequency", "Fréquence")}
          </div>
        );

      case 7:
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">
              Résumé de la Configuration
            </h3>
            <div className="space-y-2">
              <p>
                <strong>Profil :</strong> {data.profileName}
              </p>
              <p>
                <strong>Mesures configurées :</strong>
              </p>
              <ul className="list-disc list-inside space-y-1 text-sm">
                <li>
                  Valeurs nominales : Inp (@{data.inp.address}), Unp (@
                  {data.unp.address})
                  {data.un.address > 0 && `, Un (@${data.un.address})`}
                </li>
                <li>
                  Courants : L1 (@{data.currentL1.address}), L2 (@
                  {data.currentL2.address}), L3 (@{data.currentL3.address})
                </li>
                <li>
                  Tensions : U12 (@{data.voltageU12.address}), U23 (@
                  {data.voltageU23.address}), U31 (@{data.voltageU31.address})
                </li>
                <li>
                  Puissance : P (@{data.powerP.address})
                  {data.powerQ.address > 0 && `, Q (@${data.powerQ.address})`}
                  {data.powerS.address > 0 && `, S (@${data.powerS.address})`}
                </li>
                <li>Fréquence : f (@{data.frequency.address})</li>
              </ul>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  const progress = (currentStep / STEPS.length) * 100;

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle>Assistant de Configuration - Nouveau Profil</CardTitle>
        <CardDescription>
          Étape {currentStep} sur {STEPS.length} :{" "}
          {STEPS[currentStep - 1].title}
        </CardDescription>
        <Progress value={progress} className="mt-2" />
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="min-h-[400px]">{renderStepContent()}</div>

        <div className="flex justify-between pt-4 border-t">
          <Button
            variant="outline"
            onClick={() =>
              currentStep === 1
                ? onCancel()
                : setCurrentStep((prev) => prev - 1)
            }
          >
            <ChevronLeft className="mr-2 h-4 w-4" />
            {currentStep === 1 ? "Annuler" : "Précédent"}
          </Button>

          {currentStep < STEPS.length ? (
            <Button
              onClick={() => setCurrentStep((prev) => prev + 1)}
              disabled={!canProceed()}
            >
              Suivant
              <ChevronRight className="ml-2 h-4 w-4" />
            </Button>
          ) : (
            <Button onClick={handleComplete}>
              <Check className="mr-2 h-4 w-4" />
              Créer le Profil
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
