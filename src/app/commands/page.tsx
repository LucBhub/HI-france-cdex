"use client";

import { type ReactNode, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Database,
  History,
  ListFilter,
  Play,
  RadioTower,
  RefreshCw,
  Search,
  ShieldCheck,
  TerminalSquare,
  XCircle,
} from "lucide-react";

import { AppSidebar } from "@/components/layout/app-sidebar";
import { Header } from "@/components/layout/header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import withAuth from "@/components/with-auth";
import {
  ArchitectureCellule,
  ArchitectureOnduleur,
  ArchitecturePoste,
  ArchitectureSite,
  ArchitectureTreeSite,
  CommandCatalogItem,
  CommandDryRunResult,
  CommandRun,
  CommandTemplate,
  executeCommandDryRun,
  fetchArchitectureSites,
  fetchArchitectureSiteTree,
  fetchCommandCatalog,
  fetchCommandRun,
  fetchCommandRuns,
  fetchPlants,
} from "@/lib/api";
import { type Plant } from "@/lib/data";
import { cn } from "@/lib/utils";

type JsonObject = Record<string, unknown>;

const COMMON_TARGET_ORDER = [
  "site",
  "poste",
  "cellule",
  "onduleur",
  "client",
  "plantId",
  "relayId",
];

function parseMaybeJson<T>(value: T | string | null | undefined, fallback: T): T {
  if (value === null || value === undefined) return fallback;
  if (typeof value !== "string") return value as T;
  try {
    return JSON.parse(value) as T;
  } catch (_error) {
    return fallback;
  }
}

function asTemplate(command?: CommandCatalogItem | null): CommandTemplate {
  return parseMaybeJson<CommandTemplate>(command?.template, {});
}

function asMetadata(command?: CommandCatalogItem | null): JsonObject {
  return parseMaybeJson<JsonObject>(command?.metadata, {});
}

function formatJson(value: JsonObject) {
  return JSON.stringify(value, null, 2);
}

function parseJsonObject(text: string): JsonObject {
  const parsed = JSON.parse(text || "{}");
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Le JSON doit etre un objet.");
  }
  return parsed as JsonObject;
}

function formatDate(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(date);
}

function uniqueValues(values: Array<string | undefined | null>) {
  return Array.from(
    new Set(values.filter((value): value is string => Boolean(value))),
  );
}

function templatePlaceholders(template: CommandTemplate) {
  const text = [
    ...(template.topicTemplates || []),
    ...(template.tagTemplates || []),
  ].join(" ");
  const fields = new Set<string>();
  for (const match of text.matchAll(/\{([A-Za-z0-9_]+)\}/g)) {
    fields.add(match[1]);
  }
  fields.delete("client");
  return Array.from(fields);
}

function commandTargetFields(template: CommandTemplate) {
  const fields = new Set<string>([
    ...(template.requiredTarget || []),
    ...templatePlaceholders(template),
  ]);
  return Array.from(fields).sort((a, b) => {
    const aIndex = COMMON_TARGET_ORDER.indexOf(a);
    const bIndex = COMMON_TARGET_ORDER.indexOf(b);
    if (aIndex === -1 && bIndex === -1) return a.localeCompare(b);
    if (aIndex === -1) return 1;
    if (bIndex === -1) return -1;
    return aIndex - bIndex;
  });
}

function commandParamFields(template: CommandTemplate) {
  return uniqueValues([
    ...(template.requiredParams || []),
    template.payloadParam,
  ]);
}

type BadgeVariant = "default" | "secondary" | "destructive" | "outline";

function riskVariant(risk?: string): BadgeVariant {
  if (risk === "critical" || risk === "high") return "destructive";
  if (risk === "low") return "secondary";
  return "outline";
}

function statusVariant(status?: string): BadgeVariant {
  if (status?.includes("failed")) return "destructive";
  if (status === "dry_run_published" || status === "acknowledged") {
    return "secondary";
  }
  return "outline";
}

function metric(label: string, value: number | string, icon: ReactNode) {
  return (
    <Card className="rounded-md">
      <CardContent className="flex items-center justify-between gap-3 p-4">
        <div className="min-w-0">
          <div className="text-xs text-muted-foreground">{label}</div>
          <div className="mt-1 text-2xl font-semibold tabular-nums">
            {value}
          </div>
        </div>
        <div className="rounded-md border bg-muted p-2 text-muted-foreground">
          {icon}
        </div>
      </CardContent>
    </Card>
  );
}

function findById<T extends { id: number }>(items: T[], id: number | null) {
  if (!id) return null;
  return items.find((item) => item.id === id) || null;
}

function buildTarget(
  fields: string[],
  current: JsonObject,
  site: ArchitectureSite | null,
  poste: ArchitecturePoste | null,
  cellule: ArchitectureCellule | null,
  onduleur: ArchitectureOnduleur | null,
) {
  const next: JsonObject = {};
  for (const field of fields) {
    if (field === "site") next.site = site?.site_code || current.site || "";
    else if (field === "poste") next.poste = poste?.poste_code || current.poste || "";
    else if (field === "cellule") {
      next.cellule = cellule?.cellule_code || current.cellule || "";
    } else if (field === "onduleur") {
      next.onduleur = onduleur?.onduleur_code || current.onduleur || "";
    } else if (field === "client") {
      next.client = site?.client || current.client || "MQTT";
    } else if (field === "plantId" || field === "relayId") {
      next[field] = current[field] || "";
    } else {
      next[field] = current[field] || "";
    }
  }
  return next;
}

function defaultParams(template: CommandTemplate, current: JsonObject) {
  const params: JsonObject = {};
  for (const field of commandParamFields(template)) {
    if (current[field] !== undefined) {
      params[field] = current[field];
    } else if (field === template.payloadParam && template.defaultPayload !== undefined) {
      params[field] = template.defaultPayload;
    } else if (field.toLowerCase().includes("delay")) {
      params[field] = 5;
    } else {
      params[field] = "";
    }
  }
  return params;
}

function CommandCenterPage() {
  const [plants, setPlants] = useState<Plant[]>([]);
  const [catalog, setCatalog] = useState<CommandCatalogItem[]>([]);
  const [runs, setRuns] = useState<CommandRun[]>([]);
  const [selectedCommandKey, setSelectedCommandKey] = useState("");
  const [selectedRunId, setSelectedRunId] = useState<number | null>(null);
  const [selectedRun, setSelectedRun] = useState<CommandRun | null>(null);
  const [sites, setSites] = useState<ArchitectureSite[]>([]);
  const [selectedSiteId, setSelectedSiteId] = useState<number | null>(null);
  const [selectedTree, setSelectedTree] = useState<ArchitectureTreeSite | null>(
    null,
  );
  const [selectedPosteId, setSelectedPosteId] = useState<number | null>(null);
  const [selectedCelluleId, setSelectedCelluleId] = useState<number | null>(null);
  const [selectedOnduleurId, setSelectedOnduleurId] = useState<number | null>(
    null,
  );
  const [query, setQuery] = useState("");
  const [family, setFamily] = useState("all");
  const [targetText, setTargetText] = useState("{}");
  const [paramsText, setParamsText] = useState("{}");
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CommandDryRunResult | null>(null);

  const selectedCommand = catalog.find(
    (command) => command.command_key === selectedCommandKey,
  );
  const template = useMemo(() => asTemplate(selectedCommand), [selectedCommand]);
  const metadata = useMemo(() => asMetadata(selectedCommand), [selectedCommand]);
  const targetFields = useMemo(() => commandTargetFields(template), [template]);
  const paramFields = useMemo(() => commandParamFields(template), [template]);
  const selectedSite = findById(sites, selectedSiteId);
  const selectedPoste = findById(selectedTree?.postes || [], selectedPosteId);
  const selectedCellule = findById(
    selectedPoste?.cellules || [],
    selectedCelluleId,
  );
  const selectedOnduleur = findById(
    selectedPoste?.onduleurs || [],
    selectedOnduleurId,
  );

  const loadData = async () => {
    setLoading(true);
    setError(null);
    const [plantsData, catalogData, runData, siteData] = await Promise.all([
      fetchPlants(),
      fetchCommandCatalog(),
      fetchCommandRuns(50),
      fetchArchitectureSites(),
    ]);

    setPlants(plantsData);
    setCatalog(catalogData);
    setRuns(runData);
    setSites(siteData);
    setSelectedCommandKey((current) => current || catalogData[0]?.command_key || "");
    setSelectedRunId((current) => current || runData[0]?.id || null);
    setSelectedSiteId(
      (current) =>
        current ||
        siteData.find((site) => site.has_architecture)?.id ||
        siteData[0]?.id ||
        null,
    );
    setLoading(false);
  };

  useEffect(() => {
    loadData().catch((loadError) => {
      console.error("[Commands] Load failed:", loadError);
      setError("Impossible de charger les commandes.");
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (!selectedSiteId) {
      setSelectedTree(null);
      return;
    }

    let active = true;
    fetchArchitectureSiteTree(selectedSiteId).then((tree) => {
      if (!active) return;
      setSelectedTree(tree);
      const firstPoste = tree?.postes?.[0] || null;
      setSelectedPosteId((current) =>
        current && tree?.postes?.some((poste) => poste.id === current)
          ? current
          : firstPoste?.id || null,
      );
    });

    return () => {
      active = false;
    };
  }, [selectedSiteId]);

  useEffect(() => {
    const poste = findById(selectedTree?.postes || [], selectedPosteId);
    setSelectedCelluleId((current) =>
      current && poste?.cellules?.some((cellule) => cellule.id === current)
        ? current
        : poste?.cellules?.[0]?.id || null,
    );
    setSelectedOnduleurId((current) =>
      current && poste?.onduleurs?.some((onduleur) => onduleur.id === current)
        ? current
        : poste?.onduleurs?.[0]?.id || null,
    );
  }, [selectedPosteId, selectedTree]);

  useEffect(() => {
    if (!selectedCommand) return;
    let currentTarget: JsonObject = {};
    let currentParams: JsonObject = {};
    try {
      currentTarget = parseJsonObject(targetText);
    } catch (_error) {
      currentTarget = {};
    }
    try {
      currentParams = parseJsonObject(paramsText);
    } catch (_error) {
      currentParams = {};
    }

    setTargetText(
      formatJson(
        buildTarget(
          targetFields,
          currentTarget,
          selectedSite,
          selectedPoste,
          selectedCellule,
          selectedOnduleur,
        ),
      ),
    );
    setParamsText(formatJson(defaultParams(template, currentParams)));
  }, [
    selectedCommandKey,
    selectedSiteId,
    selectedPosteId,
    selectedCelluleId,
    selectedOnduleurId,
    selectedTree,
  ]);

  useEffect(() => {
    if (!selectedRunId) {
      setSelectedRun(null);
      return;
    }

    let active = true;
    fetchCommandRun(selectedRunId).then((run) => {
      if (active) setSelectedRun(run);
    });

    return () => {
      active = false;
    };
  }, [selectedRunId]);

  const families = useMemo(
    () => ["all", ...uniqueValues(catalog.map((command) => command.family))],
    [catalog],
  );

  const filteredCatalog = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return catalog.filter((command) => {
      if (family !== "all" && command.family !== family) return false;
      if (!normalizedQuery) return true;
      return [
        command.command_key,
        command.label,
        command.family,
        command.risk_level,
      ]
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery);
    });
  }, [catalog, family, query]);

  const runSummary = selectedRun?.eventSummary || {};
  const plannedEvents = parseMaybeJson<any[]>(
    selectedRun?.planned_events as any,
    [],
  );
  const timeline = selectedRun?.timeline || selectedRun?.events || [];
  const dryRunRuns = runs.filter((run) => run.dry_run).length;
  const acknowledgedRuns = runs.filter(
    (run) => run.eventSummary?.hasSimulatorAck,
  ).length;
  const failedRuns = runs.filter(
    (run) => run.status?.includes("failed") || run.eventSummary?.failedEvents,
  ).length;

  const execute = async () => {
    if (!selectedCommand) return;
    setRunning(true);
    setError(null);
    setResult(null);
    try {
      const target = parseJsonObject(targetText);
      const params = parseJsonObject(paramsText);
      const response = await executeCommandDryRun({
        commandKey: selectedCommand.command_key,
        target,
        params,
      });
      setResult(response);
      const latestRuns = await fetchCommandRuns(50);
      setRuns(latestRuns);
      if (response.runId) setSelectedRunId(response.runId);
      if (!response.success) {
        setError(response.message || "Commande dry-run refusee.");
      }
    } catch (executeError: any) {
      setError(executeError.message || "Commande dry-run invalide.");
    } finally {
      setRunning(false);
    }
  };

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <div className="flex h-screen flex-col">
          <Header solarPlants={plants} />
          <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
            <div className="mx-auto flex max-w-[1700px] flex-col gap-5">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div className="min-w-0">
                  <h1 className="text-2xl font-semibold">
                    Command Center dry-run
                  </h1>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Catalogue Ignition, simulation sandbox et suivi MQTT.
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={loadData}
                  disabled={loading}
                >
                  <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
                  Rafraichir
                </Button>
              </div>

              {error && (
                <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                  {error}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-6">
                {metric("Catalogue", catalog.length, <Database />)}
                {metric("Runs", runs.length, <History />)}
                {metric("Dry-run", dryRunRuns, <ShieldCheck />)}
                {metric("ACK", acknowledgedRuns, <CheckCircle2 />)}
                {metric("Echecs", failedRuns, <XCircle />)}
                {metric("Live", "bloque", <AlertTriangle />)}
              </div>

              <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(520px,0.95fr)_minmax(520px,1fr)_minmax(420px,0.85fr)]">
                <Card className="rounded-md">
                  <CardHeader className="gap-3 pb-3">
                    <div>
                      <CardTitle className="text-lg">
                        Catalogue commandes
                      </CardTitle>
                      <CardDescription>
                        {filteredCatalog.length} commande(s) affichee(s)
                      </CardDescription>
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <div className="relative min-w-[220px] flex-1">
                        <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                          value={query}
                          onChange={(event) => setQuery(event.target.value)}
                          placeholder="Rechercher une commande"
                          className="pl-9"
                        />
                      </div>
                      <Select value={family} onValueChange={setFamily}>
                        <SelectTrigger className="w-full sm:w-[170px]">
                          <ListFilter className="h-4 w-4 text-muted-foreground" />
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {families.map((item) => (
                            <SelectItem key={item} value={item}>
                              {item === "all" ? "Toutes" : item}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </CardHeader>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Commande</TableHead>
                          <TableHead>Famille</TableHead>
                          <TableHead>Risque</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {loading ? (
                          <TableRow>
                            <TableCell colSpan={3} className="h-24 text-center">
                              Chargement des commandes...
                            </TableCell>
                          </TableRow>
                        ) : filteredCatalog.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={3} className="h-24 text-center">
                              Aucune commande.
                            </TableCell>
                          </TableRow>
                        ) : (
                          filteredCatalog.map((command) => (
                            <TableRow
                              key={command.command_key}
                              className={cn(
                                "cursor-pointer",
                                selectedCommandKey === command.command_key &&
                                  "bg-muted",
                              )}
                              onClick={() =>
                                setSelectedCommandKey(command.command_key)
                              }
                            >
                              <TableCell className="max-w-[280px]">
                                <div className="truncate font-medium">
                                  {command.label}
                                </div>
                                <div className="truncate text-xs text-muted-foreground">
                                  {command.command_key}
                                </div>
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline" className="rounded-md">
                                  {command.family}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <Badge
                                  variant={riskVariant(command.risk_level)}
                                  className="rounded-md"
                                >
                                  {command.risk_level}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>

                <Card className="rounded-md">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg">
                      {selectedCommand?.label || "Simulation"}
                    </CardTitle>
                    <CardDescription>
                      {selectedCommand?.command_key || "Selectionner une commande"}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {selectedCommand && (
                      <>
                        <div className="flex flex-wrap gap-2">
                          <Badge variant="outline" className="rounded-md">
                            {selectedCommand.transport}
                          </Badge>
                          <Badge
                            variant={riskVariant(selectedCommand.risk_level)}
                            className="rounded-md"
                          >
                            {selectedCommand.risk_level}
                          </Badge>
                          <Badge variant="secondary" className="rounded-md">
                            live=false
                          </Badge>
                          <Badge variant="outline" className="rounded-md">
                            {selectedCommand.validation_status}
                          </Badge>
                        </div>

                        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                          <div className="space-y-2">
                            <Label>Site</Label>
                            <Select
                              value={selectedSiteId ? String(selectedSiteId) : "none"}
                              onValueChange={(value) =>
                                setSelectedSiteId(
                                  value === "none" ? null : Number(value),
                                )
                              }
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Site" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">Aucun</SelectItem>
                                {sites.map((site) => (
                                  <SelectItem key={site.id} value={String(site.id)}>
                                    {site.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label>Poste</Label>
                            <Select
                              value={
                                selectedPosteId ? String(selectedPosteId) : "none"
                              }
                              onValueChange={(value) =>
                                setSelectedPosteId(
                                  value === "none" ? null : Number(value),
                                )
                              }
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Poste" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">Aucun</SelectItem>
                                {(selectedTree?.postes || []).map((poste) => (
                                  <SelectItem
                                    key={poste.id}
                                    value={String(poste.id)}
                                  >
                                    {poste.type_poste || poste.poste_code}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label>Cellule</Label>
                            <Select
                              value={
                                selectedCelluleId
                                  ? String(selectedCelluleId)
                                  : "none"
                              }
                              onValueChange={(value) =>
                                setSelectedCelluleId(
                                  value === "none" ? null : Number(value),
                                )
                              }
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Cellule" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">Aucune</SelectItem>
                                {(selectedPoste?.cellules || []).map((cellule) => (
                                  <SelectItem
                                    key={cellule.id}
                                    value={String(cellule.id)}
                                  >
                                    {cellule.type_cellule ||
                                      cellule.cellule_code}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label>Onduleur</Label>
                            <Select
                              value={
                                selectedOnduleurId
                                  ? String(selectedOnduleurId)
                                  : "none"
                              }
                              onValueChange={(value) =>
                                setSelectedOnduleurId(
                                  value === "none" ? null : Number(value),
                                )
                              }
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Onduleur" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">Aucun</SelectItem>
                                {(selectedPoste?.onduleurs || []).map(
                                  (onduleur) => (
                                    <SelectItem
                                      key={onduleur.id}
                                      value={String(onduleur.id)}
                                    >
                                      {onduleur.onduleur_code}
                                    </SelectItem>
                                  ),
                                )}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                          {targetFields.map((field) => (
                            <div key={field} className="space-y-1.5">
                              <Label>{field}</Label>
                              <Input
                                value={String(
                                  parseMaybeJson<JsonObject>(targetText, {})[
                                    field
                                  ] ?? "",
                                )}
                                onChange={(event) => {
                                  const next = parseMaybeJson<JsonObject>(
                                    targetText,
                                    {},
                                  );
                                  next[field] = event.target.value;
                                  setTargetText(formatJson(next));
                                }}
                              />
                            </div>
                          ))}
                          {paramFields.map((field) => (
                            <div key={field} className="space-y-1.5">
                              <Label>{field}</Label>
                              {field === "enabled" || field === "fast" ? (
                                <Select
                                  value={String(
                                    parseMaybeJson<JsonObject>(paramsText, {})[
                                      field
                                    ] ?? "false",
                                  )}
                                  onValueChange={(value) => {
                                    const next = parseMaybeJson<JsonObject>(
                                      paramsText,
                                      {},
                                    );
                                    next[field] = value;
                                    setParamsText(formatJson(next));
                                  }}
                                >
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="true">true</SelectItem>
                                    <SelectItem value="false">false</SelectItem>
                                  </SelectContent>
                                </Select>
                              ) : (
                                <Input
                                  value={String(
                                    parseMaybeJson<JsonObject>(paramsText, {})[
                                      field
                                    ] ?? "",
                                  )}
                                  onChange={(event) => {
                                    const next = parseMaybeJson<JsonObject>(
                                      paramsText,
                                      {},
                                    );
                                    next[field] = event.target.value;
                                    setParamsText(formatJson(next));
                                  }}
                                />
                              )}
                            </div>
                          ))}
                        </div>

                        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                          <div className="space-y-2">
                            <Label>Cible JSON</Label>
                            <Textarea
                              value={targetText}
                              onChange={(event) => setTargetText(event.target.value)}
                              className="min-h-[150px] font-mono text-xs"
                              spellCheck={false}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Parametres JSON</Label>
                            <Textarea
                              value={paramsText}
                              onChange={(event) => setParamsText(event.target.value)}
                              className="min-h-[150px] font-mono text-xs"
                              spellCheck={false}
                            />
                          </div>
                        </div>

                        <div className="rounded-md border bg-muted/40 p-3 text-xs">
                          <div className="mb-2 font-medium">Templates</div>
                          <div className="space-y-1 text-muted-foreground">
                            {(template.topicTemplates || []).map((topic) => (
                              <div key={topic} className="truncate">
                                MQTT: {topic}
                              </div>
                            ))}
                            {(template.tagTemplates || []).map((tag) => (
                              <div key={tag} className="truncate">
                                TAG: {tag}
                              </div>
                            ))}
                            {Boolean(metadata.sourceView) && (
                              <div>Source: {String(metadata.sourceView)}</div>
                            )}
                          </div>
                        </div>

                        <Button
                          className="w-full"
                          onClick={execute}
                          disabled={running || !selectedCommand}
                        >
                          <Play className="h-4 w-4" />
                          Lancer dry-run
                        </Button>

                        {result && (
                          <div
                            className={cn(
                              "rounded-md border p-3 text-sm",
                              result.success
                                ? "border-emerald-500/40 bg-emerald-500/10"
                                : "border-destructive/40 bg-destructive/10 text-destructive",
                            )}
                          >
                            <div className="font-medium">
                              {result.success ? "Dry-run planifie" : result.code}
                            </div>
                            <div className="mt-1 text-xs">{result.message}</div>
                            {result.runId && (
                              <div className="mt-1 text-xs tabular-nums">
                                Run #{result.runId} - {result.status}
                              </div>
                            )}
                          </div>
                        )}
                      </>
                    )}
                  </CardContent>
                </Card>

                <Card className="rounded-md">
                  <CardHeader className="gap-3 pb-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <CardTitle className="text-lg">Runs</CardTitle>
                        <CardDescription>
                          {runs.length} execution(s) recentes
                        </CardDescription>
                      </div>
                      <Button
                        size="icon"
                        variant="outline"
                        aria-label="Rafraichir les runs"
                        onClick={async () => setRuns(await fetchCommandRuns(50))}
                      >
                        <RefreshCw className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="max-h-[260px] overflow-auto rounded-md border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Run</TableHead>
                            <TableHead>Statut</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {runs.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={2} className="h-20 text-center">
                                Aucun run.
                              </TableCell>
                            </TableRow>
                          ) : (
                            runs.map((run) => (
                              <TableRow
                                key={run.id}
                                className={cn(
                                  "cursor-pointer",
                                  selectedRunId === run.id && "bg-muted",
                                )}
                                onClick={() => setSelectedRunId(run.id)}
                              >
                                <TableCell>
                                  <div className="font-medium tabular-nums">
                                    #{run.id}
                                  </div>
                                  <div className="truncate text-xs text-muted-foreground">
                                    {run.command_key}
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <Badge
                                    variant={statusVariant(run.status)}
                                    className="rounded-md"
                                  >
                                    {run.eventSummary?.sandboxStatus ||
                                      run.status}
                                  </Badge>
                                </TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </div>

                    <Separator />

                    {selectedRun ? (
                      <div className="space-y-4">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="outline" className="rounded-md">
                            #{selectedRun.id}
                          </Badge>
                          <Badge
                            variant={statusVariant(selectedRun.status)}
                            className="rounded-md"
                          >
                            {selectedRun.status}
                          </Badge>
                          <Badge variant="secondary" className="rounded-md">
                            dry-run
                          </Badge>
                        </div>

                        <div className="grid grid-cols-2 gap-3 text-sm">
                          <SummaryItem
                            label="Publies"
                            value={`${runSummary.publishedPublishes || 0}/${
                              runSummary.plannedPublishes || 0
                            }`}
                            icon={<RadioTower className="h-4 w-4" />}
                          />
                          <SummaryItem
                            label="ACK"
                            value={runSummary.simulatorAcks || 0}
                            icon={<CheckCircle2 className="h-4 w-4" />}
                          />
                          <SummaryItem
                            label="Tag writes"
                            value={runSummary.plannedTagWrites || 0}
                            icon={<TerminalSquare className="h-4 w-4" />}
                          />
                          <SummaryItem
                            label="Dernier"
                            value={formatDate(runSummary.lastEventAt)}
                            icon={<Clock3 className="h-4 w-4" />}
                          />
                        </div>

                        <div className="space-y-2">
                          <div className="text-xs font-medium text-muted-foreground">
                            Evenements planifies
                          </div>
                          <div className="max-h-[160px] space-y-2 overflow-auto">
                            {(plannedEvents as any[]).map((event, index) => (
                              <EventLine
                                key={`${event.topic || event.tagPath}-${index}`}
                                label={event.transport || "event"}
                                topic={event.topic || event.tagPath}
                                payload={event.payload}
                                status={
                                  event.plannedPulseMs
                                    ? `${event.plannedPulseMs} ms`
                                    : undefined
                                }
                              />
                            ))}
                          </div>
                        </div>

                        <div className="space-y-2">
                          <div className="text-xs font-medium text-muted-foreground">
                            Timeline sandbox
                          </div>
                          <div className="max-h-[260px] space-y-2 overflow-auto">
                            {timeline.length === 0 ? (
                              <div className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">
                                Aucun evenement.
                              </div>
                            ) : (
                              timeline.map((event) => (
                                <EventLine
                                  key={event.id}
                                  label={event.type || event.event_type || "event"}
                                  topic={event.topic}
                                  payload={event.payload}
                                  status={event.status}
                                  at={formatDate(event.at)}
                                />
                              ))
                            )}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
                        Selectionner un run.
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          </main>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

function SummaryItem({
  label,
  value,
  icon,
}: {
  label: string;
  value: string | number;
  icon: ReactNode;
}) {
  return (
    <div className="rounded-md border p-3">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className="mt-1 truncate font-medium tabular-nums">{value}</div>
    </div>
  );
}

function EventLine({
  label,
  topic,
  payload,
  status,
  at,
}: {
  label?: string;
  topic?: string;
  payload?: string;
  status?: string;
  at?: string;
}) {
  return (
    <div className="rounded-md border p-2 text-xs">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline" className="rounded-md">
          {label}
        </Badge>
        {status && (
          <Badge variant={statusVariant(status)} className="rounded-md">
            {status}
          </Badge>
        )}
        {at && <span className="text-muted-foreground">{at}</span>}
      </div>
      <div className="mt-1 truncate font-mono">{topic || "-"}</div>
      {payload !== undefined && (
        <div className="mt-1 truncate font-mono text-muted-foreground">
          payload: {payload}
        </div>
      )}
    </div>
  );
}

export default withAuth(CommandCenterPage, ["member", "admin", "superadmin"]);
