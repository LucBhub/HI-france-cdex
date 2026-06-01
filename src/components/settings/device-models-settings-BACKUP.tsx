"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { t } from "@/lib/i18n";
import { useLanguage } from "@/contexts/language-context";
import {
  fetchDeviceModels,
  createDeviceModel,
  updateDeviceModel,
} from "@/lib/api";

// Simple form schema - only essential addresses
const simpleFormSchema = z.object({
  id: z
    .string()
    .min(1, "ID is required")
    .regex(/^[a-z0-9-]+$/, "ID must be lowercase alphanumeric with hyphens"),
  name: z.string().min(1, "Name is required"),

  // Nominal values - just addresses
  inpAddress: z.coerce.number().min(0),
  unpAddress: z.coerce.number().min(0),

  // Measurements - just base addresses
  currentsAddress: z.coerce.number().min(0),
  voltagesAddress: z.coerce.number().min(0),
  frequencyAddress: z.coerce.number().min(0),
  powersAddress: z.coerce.number().min(0),

  // Breaker & Control
  breakerAddress: z.coerce.number().min(0),
  coupleAddress: z.coerce.number().min(0),
  decoupleAddress: z.coerce.number().min(0),
  resetAddress: z.coerce.number().min(0).optional().or(z.literal("")),
});

// Advanced JSON schema
const jsonFormSchema = z.object({
  id: z
    .string()
    .min(1, "ID is required")
    .regex(/^[a-z0-9-]+$/, "ID must be lowercase alphanumeric with hyphens"),
  name: z.string().min(1, "Name is required"),
  config: z
    .string()
    .min(1, "Configuration JSON is required")
    .refine((val) => {
      try {
        JSON.parse(val);
        return true;
      } catch (e) {
        return false;
      }
    }, "Invalid JSON format"),
});

type SimpleFormValues = z.infer<typeof simpleFormSchema>;
type JsonFormValues = z.infer<typeof jsonFormSchema>;

interface DeviceModel {
  id: string;
  name: string;
  config: any;
}

export function DeviceModelsSettings() {
  const { toast } = useToast();
  const { language } = useLanguage();
  const [models, setModels] = useState<DeviceModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [mode, setMode] = useState<"simple" | "advanced">("simple");
  const [editingModelId, setEditingModelId] = useState<string | null>(null);

  const defaultValues = {
    id: "",
    name: "",
    inpAddress: 77,
    unpAddress: 85,
    currentsAddress: 390,
    voltagesAddress: 398,
    frequencyAddress: 442,
    powersAddress: 478,
    breakerAddress: 317,
    coupleAddress: 15,
    decoupleAddress: 14,
    resetAddress: 2,
  };

  const simpleForm = useForm<SimpleFormValues>({
    resolver: zodResolver(simpleFormSchema),
    defaultValues,
  });

  const jsonForm = useForm<JsonFormValues>({
    resolver: zodResolver(jsonFormSchema),
    defaultValues: {
      id: "",
      name: "",
      config: "",
    },
  });

  useEffect(() => {
    fetchModels();
  }, []);

  const fetchModels = async () => {
    try {
      const data = await fetchDeviceModels();
      setModels(data);
    } catch (error) {
      console.error("Failed to fetch models", error);
    } finally {
      setLoading(false);
    }
  };

  const onSimpleSubmit = async (data: SimpleFormValues) => {
    setIsSubmitting(true);
    try {
      // Build config automatically with smart defaults
      const config: any = {
        nominal: {
          inp: { address: data.inpAddress, type: "ulong", length: 2 },
          unp: { address: data.unpAddress, type: "ulong", length: 2 },
        },
        measurements: {
          currents: {
            address: data.currentsAddress,
            length: 14,
            scale: 0.001,
          },
          voltages: {
            address: data.currentsAddress,
            offset: data.voltagesAddress - data.currentsAddress,
            length: 6,
            scale: 0.001,
          },
          frequency: {
            address: data.frequencyAddress,
            length: 2,
            scale: 0.001,
          },
          powers: {
            address: data.powersAddress,
            length: 6,
            formula: "((val / 3000000) * Pn) / 1000",
          },
        },
        breakerStatus: {
          discrete: data.breakerAddress,
          holding: data.breakerAddress,
        },
        control: {
          couple: data.coupleAddress,
          decouple: data.decoupleAddress,
        },
      };

      if (data.resetAddress !== "" && data.resetAddress !== undefined) {
        config.control.reset = Number(data.resetAddress);
      }

      let result;
      if (editingModelId) {
        // Update existing model
        result = await updateDeviceModel(editingModelId, {
          name: data.name,
          config,
        });
      } else {
        // Create new model
        result = await createDeviceModel({
          id: data.id,
          name: data.name,
          config,
        });
      }

      if (result.success) {
        toast({
          title: t("success", language),
          description: editingModelId
            ? "Modèle mis à jour avec succès."
            : "Modèle créé avec succès.",
        });
        simpleForm.reset();
        setEditingModelId(null);
        fetchModels();
      } else {
        toast({
          variant: "destructive",
          title: t("error", language),
          description: result.message || "Erreur lors de la création.",
        });
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: t("error", language),
        description: "Une erreur inattendue est survenue.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditModel = (model: DeviceModel) => {
    setEditingModelId(model.id);
    setMode("simple");

    // Pre-fill form with model data
    const config = model.config;
    simpleForm.reset({
      id: model.id,
      name: model.name,
      inpAddress: config.nominal?.inp?.address || 77,
      unpAddress: config.nominal?.unp?.address || 85,
      currentsAddress: config.measurements?.currents?.address || 390,
      voltagesAddress:
        (config.measurements?.currents?.address || 390) +
        (config.measurements?.voltages?.offset || 8),
      frequencyAddress: config.measurements?.frequency?.address || 442,
      powersAddress: config.measurements?.powers?.address || 478,
      breakerAddress:
        config.breakerStatus?.discrete || config.breakerStatus?.holding || 317,
      coupleAddress: config.control?.couple || 15,
      decoupleAddress: config.control?.decouple || 14,
      resetAddress: config.control?.reset || "",
    });
  };

  const handleCancelEdit = () => {
    setEditingModelId(null);
    simpleForm.reset();
  };

  const onJsonSubmit = async (data: JsonFormValues) => {
    setIsSubmitting(true);
    try {
      const result = await createDeviceModel({
        ...data,
        config: JSON.parse(data.config),
      });

      if (result.success) {
        toast({
          title: t("success", language),
          description: "Modèle créé avec succès.",
        });
        jsonForm.reset();
        fetchModels();
      } else {
        toast({
          variant: "destructive",
          title: t("error", language),
          description: result.message || "Erreur lors de la création.",
        });
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: t("error", language),
        description: "Une erreur inattendue est survenue.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-8">
      <Card>
        <CardHeader>
          <CardTitle>
            {editingModelId
              ? "Modifier le modèle de relais"
              : "Ajouter un nouveau modèle de relais"}
          </CardTitle>
          <CardDescription>
            Définissez un nouveau modèle de relais Thytronic XMR-A en indiquant
            les adresses Modbus des registres (IDX - 1).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs
            value={mode}
            onValueChange={(v) => setMode(v as "simple" | "advanced")}
          >
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="simple">Mode Simple</TabsTrigger>
              <TabsTrigger value="advanced">Mode Avancé (JSON)</TabsTrigger>
            </TabsList>

            <TabsContent value="simple">
              <Form {...simpleForm}>
                <form
                  onSubmit={simpleForm.handleSubmit(onSimpleSubmit)}
                  className="space-y-8"
                >
                  {/* Basic Info */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold">Identification</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={simpleForm.control}
                        name="id"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>ID du modèle *</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="thytronic-custom"
                                {...field}
                                disabled={!!editingModelId}
                              />
                            </FormControl>
                            <FormDescription>
                              Minuscules et tirets uniquement
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={simpleForm.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Nom du modèle *</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="Thytronic XMR Custom"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>

                  {/* Nominal Values */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold">Valeurs Nominales</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={simpleForm.control}
                        name="inpAddress"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>
                              Adresse Inp (Courant nominal primaire) *
                            </FormLabel>
                            <FormControl>
                              <Input type="number" {...field} />
                            </FormControl>
                            <FormDescription>
                              IDX {defaultValues.inpAddress + 1} dans XMR
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={simpleForm.control}
                        name="unpAddress"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>
                              Adresse Unp (Tension nominale primaire) *
                            </FormLabel>
                            <FormControl>
                              <Input type="number" {...field} />
                            </FormControl>
                            <FormDescription>
                              IDX {defaultValues.unpAddress + 1} dans XMR
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>

                  {/* Measurements */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold">
                      Mesures en Temps Réel
                    </h3>

                    {/* Currents */}
                    <div className="space-y-2">
                      <Label className="text-base">
                        Courants (I L1, L2, L3)
                      </Label>
                      <FormField
                        control={simpleForm.control}
                        name="currentsAddress"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Adresse L1 *</FormLabel>
                            <FormControl>
                              <Input type="number" {...field} />
                            </FormControl>
                            <FormDescription>
                              IDX 391 (L1), 393 (L2), 395 (L3) - Lit 6 registres
                              consécutifs
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    {/* Voltages */}
                    <div className="space-y-2">
                      <Label className="text-base">
                        Tensions (U L1, L2, L3)
                      </Label>
                      <FormField
                        control={simpleForm.control}
                        name="voltagesAddress"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Adresse L1 *</FormLabel>
                            <FormControl>
                              <Input type="number" {...field} />
                            </FormControl>
                            <FormDescription>
                              IDX 399 (L1), 401 (L2), 403 (L3) - Lit 6 registres
                              consécutifs
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    {/* Frequency */}
                    <div className="space-y-2">
                      <Label className="text-base">Fréquence</Label>
                      <FormField
                        control={simpleForm.control}
                        name="frequencyAddress"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Adresse *</FormLabel>
                            <FormControl>
                              <Input type="number" {...field} />
                            </FormControl>
                            <FormDescription>
                              IDX {defaultValues.frequencyAddress + 1} dans XMR
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    {/* Powers */}
                    <div className="space-y-2">
                      <Label className="text-base">Puissances (P, Q, S)</Label>
                      <FormField
                        control={simpleForm.control}
                        name="powersAddress"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Adresse *</FormLabel>
                            <FormControl>
                              <Input type="number" {...field} />
                            </FormControl>
                            <FormDescription>
                              IDX {defaultValues.powersAddress + 1} - P active,
                              Q réactive, S apparente
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>

                  {/* Breaker Status */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold">État Disjoncteur</h3>
                    <FormField
                      control={simpleForm.control}
                      name="breakerAddress"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Adresse État Disjoncteur *</FormLabel>
                          <FormControl>
                            <Input type="number" {...field} />
                          </FormControl>
                          <FormDescription>
                            IDX {defaultValues.breakerAddress + 1} - Utilisé
                            pour Discrete Input ET Holding Register
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* Control Commands */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold">
                      Commandes de Contrôle (Coils / Bobines)
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <FormField
                        control={simpleForm.control}
                        name="coupleAddress"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Adresse Couple (Fermeture) *</FormLabel>
                            <FormControl>
                              <Input type="number" {...field} />
                            </FormControl>
                            <FormDescription>
                              IDX {defaultValues.coupleAddress + 1} - Chiusura
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={simpleForm.control}
                        name="decoupleAddress"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>
                              Adresse Decouple (Ouverture) *
                            </FormLabel>
                            <FormControl>
                              <Input type="number" {...field} />
                            </FormControl>
                            <FormDescription>
                              IDX {defaultValues.decoupleAddress + 1} - Apertura
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={simpleForm.control}
                        name="resetAddress"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Adresse Reset</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                placeholder="Optionnel"
                                {...field}
                              />
                            </FormControl>
                            <FormDescription>
                              IDX {(defaultValues.resetAddress || 0) + 1}{" "}
                              (optionnel)
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <Button type="submit" disabled={isSubmitting}>
                      {isSubmitting
                        ? editingModelId
                          ? "Mise à jour..."
                          : "Création..."
                        : editingModelId
                          ? "Mettre à Jour"
                          : "Créer le Modèle"}
                    </Button>
                    {editingModelId && (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleCancelEdit}
                      >
                        Annuler
                      </Button>
                    )}
                    <p className="text-sm text-muted-foreground">
                      Les paramètres avancés (length, scale, formule) sont
                      définis automatiquement.
                    </p>
                  </div>
                </form>
              </Form>
            </TabsContent>

            <TabsContent value="advanced">
              <Form {...jsonForm}>
                <form
                  onSubmit={jsonForm.handleSubmit(onJsonSubmit)}
                  className="space-y-6"
                >
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={jsonForm.control}
                      name="id"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>ID du modèle</FormLabel>
                          <FormControl>
                            <Input placeholder="mon-modele" {...field} />
                          </FormControl>
                          <FormDescription>
                            Identifiant unique (minuscules, tirets).
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={jsonForm.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Nom du modèle</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="Mon Nouveau Modèle"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <FormField
                    control={jsonForm.control}
                    name="config"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Configuration (JSON)</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder='{"nominal": { ... }, "measurements": { ... }}'
                            className="font-mono h-48"
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>
                          Configuration JSON complète du modèle.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? "Création..." : "Créer le Modèle"}
                  </Button>
                </form>
              </Form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Modèles Existants</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Nom</TableHead>
                <TableHead>Aperçu Config</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {models.map((model) => (
                <TableRow key={model.id}>
                  <TableCell className="font-medium">{model.id}</TableCell>
                  <TableCell>{model.name}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground truncate max-w-xs">
                    {JSON.stringify(model.config)}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEditModel(model)}
                    >
                      Modifier
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {models.length === 0 && !loading && (
                <TableRow>
                  <TableCell
                    colSpan={4}
                    className="text-center text-muted-foreground"
                  >
                    Aucun modèle trouvé.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
