"use client";

import { useState, useEffect } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { type Plant } from "@/lib/data";
import {
  addPlant,
  updatePlant,
  deletePlant,
  fetchDeviceModels,
} from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";
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
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Trash2, PlusCircle, Pencil, X } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

import { t } from "@/lib/i18n";
import { useLanguage } from "@/contexts/language-context";

const plantFormSchema = z.object({
  name: z.string().min(1, "Name is required"),
  status: z.string().min(1, "Status is required"),
  powerKwc: z.coerce.number().positive("Power must be a positive number"),
  gps: z.string().optional(),
  address: z.string().optional(),
  ce: z.string().optional(),
  modemLogin: z.string().optional(),
  modemPassword: z.string().optional(),
  acrMerignac: z.string().optional(),
  deliveryStation: z.string().optional(),
  departureStation: z.string().optional(),
  sourceStation: z.string().optional(),
  card1: z.string().optional(),
  email: z.string().optional(), // Add email to schema
  relays: z.array(
    z.object({
      ipAddress: z.string().ip({ message: "Invalid IP address" }),
      port: z.string().optional(),
      unitId: z.string().optional(),
      modelId: z.string().optional(),
    }),
  ),
});

type PlantFormValues = z.infer<typeof plantFormSchema>;

interface PlantSettingsProps {
  initialPlants: Plant[];
}

export function PlantSettings({ initialPlants }: PlantSettingsProps) {
  const { toast } = useToast();
  const router = useRouter();
  const [plants, setPlants] = useState<Plant[]>(initialPlants);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const { language } = useLanguage();

  const form = useForm<PlantFormValues>({
    resolver: zodResolver(plantFormSchema),
    defaultValues: {
      name: "",
      status: "operational",
      powerKwc: 0,
      gps: "",
      address: "",
      email: "", // Add default value
      relays: [
        { ipAddress: "", port: "502", unitId: "1", modelId: "thytronic-xmr-a" },
      ],
    },
  });

  const [availableModels, setAvailableModels] = useState<
    { id: string; name: string }[]
  >([]);

  useEffect(() => {
    const loadModels = async () => {
      const data = await fetchDeviceModels();
      setAvailableModels(data);
    };
    loadModels();
  }, []);

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "relays",
  });

  const onSubmit = async (data: PlantFormValues) => {
    setIsSubmitting(true);
    const submissionData = {
      ...data,
      relays: data.relays
        .filter((relay) => relay.ipAddress)
        .map((relay) => {
          const portNumber =
            relay.port && relay.port.trim() !== ""
              ? Number(relay.port)
              : undefined;
          const unitIdNumber =
            relay.unitId && relay.unitId.trim() !== ""
              ? Number(relay.unitId)
              : undefined;

          return {
            ipAddress: relay.ipAddress,
            port: Number.isFinite(portNumber) ? portNumber : undefined,
            unitId: Number.isFinite(unitIdNumber) ? unitIdNumber : undefined,
            modelId: relay.modelId || "thytronic-xmr-a",
          };
        }),
    };

    let result;
    if (editingId) {
      result = await updatePlant(editingId, submissionData);
    } else {
      result = await addPlant(submissionData);
    }

    if (result.success && result.plant) {
      toast({
        title: t("success", language),
        description: editingId
          ? "Plant updated successfully"
          : t("plantAddedSuccess", language),
      });

      if (editingId) {
        setPlants((prev) =>
          prev.map((p) => (p.id === editingId ? result.plant! : p)),
        );
        setEditingId(null);
      } else {
        setPlants((prev) => [...prev, result.plant!]);
      }

      form.reset({
        name: "",
        status: "operational",
        powerKwc: 0,
        gps: "",
        address: "",
        email: "", // Reset email
        relays: [
          {
            ipAddress: "",
            port: "502",
            unitId: "1",
            modelId: "thytronic-xmr-a",
          },
        ],
      });
      router.refresh();
    } else {
      toast({
        variant: "destructive",
        title: t("error", language),
        description:
          result.message ||
          (editingId ? "Failed to update" : t("failedToAddPlant", language)),
      });
    }
    setIsSubmitting(false);
  };

  const handleEdit = (plant: Plant) => {
    setEditingId(plant.id);
    form.reset({
      name: plant.name,
      status: plant.status,
      powerKwc: plant.powerKwc,
      gps: plant.gps || "",
      address: plant.address || "",
      ce: plant.ce || "",
      modemLogin: plant.modemLogin || "",
      modemPassword: plant.modemPassword || "",
      acrMerignac: plant.acrMerignac || "",
      deliveryStation: plant.deliveryStation || "",
      departureStation: plant.departureStation || "",
      sourceStation: plant.sourceStation || "",
      card1: plant.card1 || "",
      email: plant.email || "", // Populate email
      relays:
        plant.relays && plant.relays.length > 0
          ? plant.relays.map((r) => ({
              ipAddress: r.ipAddress,
              port: r.port?.toString() || "502",
              unitId: r.unitId?.toString() || "1",
              modelId: r.modelId || "thytronic-xmr-a",
            }))
          : [
              {
                ipAddress: "",
                port: "502",
                unitId: "1",
                modelId: "thytronic-xmr-a",
              },
            ],
    });

    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    form.reset({
      name: "",
      status: "operational",
      powerKwc: 0,
      gps: "",
      address: "",
      email: "", // Reset on cancel
      relays: [
        { ipAddress: "", port: "502", unitId: "1", modelId: "thytronic-xmr-a" },
      ],
    });
  };

  const handleDelete = async (id: number) => {
    const result = await deletePlant(id);
    if (result.success) {
      toast({
        title: t("success", language),
        description: t("plantDeletedSuccess", language),
      });
      setPlants((prev) => prev.filter((p) => p.id !== id));
      if (editingId === id) handleCancelEdit();
      router.refresh();
    } else {
      toast({
        variant: "destructive",
        title: t("error", language),
        description: result.message || t("failedToDeletePlant", language),
      });
    }
  };

  return (
    <div className="space-y-8">
      <Card className={editingId ? "border-amber-400 border-2" : ""}>
        <CardHeader>
          <CardTitle>
            {editingId
              ? `Edit Plant: ${plants.find((p) => p.id === editingId)?.name}`
              : t("addNewPlant", language)}
          </CardTitle>
          <CardDescription>
            {editingId
              ? "Update the details below."
              : t("fillPlantForm", language)}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("plantName", language)}</FormLabel>
                      <FormControl>
                        <Input placeholder="Alpha Solar One" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("status", language)}</FormLabel>
                      <FormControl>
                        <Input placeholder="operational" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="powerKwc"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("nominalPower", language)}</FormLabel>
                      <FormControl>
                        <Input type="number" placeholder="5000" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="gps"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("location", language)}</FormLabel>
                      <FormControl>
                        <Input placeholder="44.6172,-0.6187" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email (Optional)</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="contact@example.com, tech@example.com"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div>
                <FormLabel>{t("relayConfiguration", language)}</FormLabel>
                <div className="space-y-2 mt-2">
                  <div className="hidden md:grid grid-cols-12 gap-2 text-xs font-medium text-muted-foreground">
                    <span className="md:col-span-4">
                      {t("ipAddress", language)}
                    </span>
                    <span className="md:col-span-2">{t("port", language)}</span>
                    <span className="md:col-span-2">
                      {t("unitId", language)}
                    </span>
                    <span className="md:col-span-4">Model</span>
                  </div>
                  {fields.map((field, index) => (
                    <div
                      key={field.id}
                      className="grid grid-cols-1 md:grid-cols-12 gap-2"
                    >
                      <div className="md:col-span-4">
                        <FormField
                          control={form.control}
                          name={`relays.${index}.ipAddress`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="md:hidden">
                                {t("ipAddress", language)}
                              </FormLabel>
                              <div className="flex items-center gap-2">
                                <FormControl>
                                  <Input placeholder="10.8.1.10" {...field} />
                                </FormControl>
                                <Button
                                  type="button"
                                  variant="destructive"
                                  size="icon"
                                  onClick={() => remove(index)}
                                  disabled={fields.length <= 1}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                      <div className="md:col-span-2">
                        <FormField
                          control={form.control}
                          name={`relays.${index}.port`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="md:hidden">
                                {t("port", language)}
                              </FormLabel>
                              <FormControl>
                                <Input
                                  type="number"
                                  min={1}
                                  max={65535}
                                  placeholder="502"
                                  {...field}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                      <div className="md:col-span-2">
                        <FormField
                          control={form.control}
                          name={`relays.${index}.unitId`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="md:hidden">
                                {t("unitId", language)}
                              </FormLabel>
                              <FormControl>
                                <Input
                                  type="number"
                                  min={1}
                                  max={247}
                                  placeholder="1"
                                  {...field}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                      <div className="md:col-span-4">
                        <FormField
                          control={form.control}
                          name={`relays.${index}.modelId`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="md:hidden">Model</FormLabel>
                              <Select
                                onValueChange={field.onChange}
                                defaultValue={field.value}
                                value={field.value}
                              >
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select model" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {availableModels.map((model) => (
                                    <SelectItem key={model.id} value={model.id}>
                                      {model.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mt-2"
                    onClick={() =>
                      append({
                        ipAddress: "",
                        port: "502",
                        unitId: "1",
                        modelId: "thytronic-xmr-a",
                      })
                    }
                  >
                    <PlusCircle className="mr-2 h-4 w-4" />
                    {t("addRelay", language)}
                  </Button>
                </div>
              </div>

              <div className="flex gap-2">
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting
                    ? editingId
                      ? "Updating..."
                      : t("adding", language)
                    : editingId
                      ? "Update Plant"
                      : t("addPlant", language)}
                </Button>

                {editingId && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleCancelEdit}
                  >
                    Cancel
                  </Button>
                )}
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>{t("manageExistingPlants", language)}</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("plantName", language)}</TableHead>
                <TableHead>{t("status", language)}</TableHead>
                <TableHead>{t("relays", language)}</TableHead>
                <TableHead className="text-right">
                  {t("actions", language)}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {plants.map((plant) => (
                <TableRow key={plant.id}>
                  <TableCell>{plant.name}</TableCell>
                  <TableCell>{plant.status}</TableCell>
                  <TableCell>
                    {plant.relays && plant.relays.length > 0 ? (
                      <div className="space-y-1">
                        {plant.relays.map((relay) => (
                          <div key={relay.id} className="text-xs">
                            {relay.ipAddress}
                            {relay.port ? `:${relay.port}` : ""}
                            {typeof relay.unitId !== "undefined"
                              ? ` (ID ${relay.unitId})`
                              : ""}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        {t("noRelays", language)}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEdit(plant)}
                      >
                        <Pencil className="h-4 w-4 text-blue-500" />
                      </Button>

                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>
                              {t("areYouSure", language)}
                            </AlertDialogTitle>
                            <AlertDialogDescription>
                              {t("deletePlantWarning", language)}
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>
                              {t("cancel", language)}
                            </AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDelete(plant.id)}
                            >
                              {t("continue", language)}
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
