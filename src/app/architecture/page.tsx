"use client";

import { type ReactNode, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  CircleDot,
  Database,
  GitBranch,
  ListTree,
  MapPin,
  Network,
  RefreshCw,
  Search,
  Server,
  Zap,
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
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import withAuth from "@/components/with-auth";
import {
  ArchitectureSite,
  ArchitectureSummary,
  ArchitectureTreeSite,
  fetchArchitectureSites,
  fetchArchitectureSiteTree,
  fetchArchitectureSummary,
  fetchPlants,
} from "@/lib/api";
import { type Plant } from "@/lib/data";
import { cn } from "@/lib/utils";

type FilterMode = "all" | "with_architecture" | "without_architecture";

function formatNumber(value: number | string | null | undefined) {
  const numberValue = Number(value || 0);
  return new Intl.NumberFormat("fr-FR").format(numberValue);
}

function formatCoordinate(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === "") return "-";
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) return "-";
  return numberValue.toFixed(5);
}

function rawSourceValue(site: ArchitectureSite, key: string) {
  const raw =
    typeof site.raw_source === "string"
      ? (() => {
          try {
            return JSON.parse(site.raw_source);
          } catch (_error) {
            return {};
          }
        })()
      : site.raw_source || {};
  return raw[key] ? String(raw[key]) : "-";
}

function metricLabel(label: string, value: number, icon: ReactNode) {
  return (
    <Card className="rounded-md">
      <CardContent className="flex items-center justify-between gap-3 p-4">
        <div className="min-w-0">
          <div className="text-xs text-muted-foreground">{label}</div>
          <div className="mt-1 text-2xl font-semibold tabular-nums">
            {formatNumber(value)}
          </div>
        </div>
        <div className="rounded-md border bg-muted p-2 text-muted-foreground">
          {icon}
        </div>
      </CardContent>
    </Card>
  );
}

function ArchitecturePage() {
  const [plants, setPlants] = useState<Plant[]>([]);
  const [summary, setSummary] = useState<ArchitectureSummary | null>(null);
  const [sites, setSites] = useState<ArchitectureSite[]>([]);
  const [selectedSite, setSelectedSite] = useState<ArchitectureTreeSite | null>(
    null,
  );
  const [selectedSiteId, setSelectedSiteId] = useState<number | null>(null);
  const [query, setQuery] = useState("");
  const [filterMode, setFilterMode] = useState<FilterMode>("all");
  const [loading, setLoading] = useState(true);
  const [treeLoading, setTreeLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    const [plantsData, summaryData, siteRows] = await Promise.all([
      fetchPlants(),
      fetchArchitectureSummary(),
      fetchArchitectureSites(),
    ]);

    setPlants(plantsData);
    setSummary(summaryData);
    setSites(siteRows);
    const firstSite = siteRows.find((site) => site.has_architecture) || siteRows[0];
    setSelectedSiteId(firstSite?.id || null);
    setLoading(false);
  };

  useEffect(() => {
    loadData().catch((loadError) => {
      console.error("[Architecture] Load failed:", loadError);
      setError("Impossible de charger l'architecture.");
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (!selectedSiteId) {
      setSelectedSite(null);
      return;
    }

    let active = true;
    setTreeLoading(true);
    fetchArchitectureSiteTree(selectedSiteId)
      .then((tree) => {
        if (active) setSelectedSite(tree);
      })
      .finally(() => {
        if (active) setTreeLoading(false);
      });

    return () => {
      active = false;
    };
  }, [selectedSiteId]);

  const filteredSites = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return sites.filter((site) => {
      const matchesFilter =
        filterMode === "all" ||
        (filterMode === "with_architecture" && site.has_architecture) ||
        (filterMode === "without_architecture" && !site.has_architecture);
      if (!matchesFilter) return false;
      if (!normalizedQuery) return true;

      return [
        site.name,
        site.site_code,
        site.client || "",
        site.ce || "",
        rawSourceValue(site, "idCentrale"),
      ]
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery);
    });
  }, [filterMode, query, sites]);

  const selectedFlatSite = sites.find((site) => site.id === selectedSiteId);
  const sitesWithoutArchitecture =
    summary?.sitesWithoutArchitecture ??
    sites.filter((site) => !site.has_architecture).length;

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <div className="flex h-screen flex-col">
          <Header solarPlants={plants} />
          <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
            <div className="mx-auto flex max-w-[1600px] flex-col gap-5">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div className="min-w-0">
                  <h1 className="text-2xl font-semibold">Architecture France</h1>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Validation read-only des sites, postes, cellules,
                    équipements et onduleurs importés depuis Ignition.
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={loadData}
                  disabled={loading}
                >
                  <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
                  Rafraîchir
                </Button>
              </div>

              {error && (
                <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                  {error}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">
                {metricLabel("Sites", summary?.sites || sites.length, <MapPin />)}
                {metricLabel(
                  "Avec architecture",
                  summary?.sitesWithArchitecture || 0,
                  <CheckCircle2 />,
                )}
                {metricLabel(
                  "Sans architecture",
                  sitesWithoutArchitecture,
                  <AlertTriangle />,
                )}
                {metricLabel("Postes", summary?.postes || 0, <Network />)}
                {metricLabel("Cellules", summary?.cellules || 0, <GitBranch />)}
                {metricLabel("Equipements", summary?.equipements || 0, <Server />)}
                {metricLabel("Onduleurs", summary?.onduleurs || 0, <Zap />)}
                {metricLabel("Commandes", summary?.commands || 0, <Database />)}
              </div>

              <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(720px,1fr)_minmax(420px,520px)]">
                <Card className="rounded-md">
                  <CardHeader className="gap-3 pb-3">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                      <div>
                        <CardTitle className="text-lg">
                          Sites importés
                        </CardTitle>
                        <CardDescription>
                          {formatNumber(filteredSites.length)} site(s) affiché(s)
                        </CardDescription>
                      </div>
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                        <div className="relative min-w-[240px]">
                          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                          <Input
                            value={query}
                            onChange={(event) => setQuery(event.target.value)}
                            placeholder="Rechercher site, CE, centrale"
                            className="pl-9"
                          />
                        </div>
                        <div className="flex gap-1">
                          <Button
                            type="button"
                            size="sm"
                            variant={filterMode === "all" ? "default" : "outline"}
                            onClick={() => setFilterMode("all")}
                          >
                            <ListTree />
                            Tous
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant={
                              filterMode === "with_architecture"
                                ? "default"
                                : "outline"
                            }
                            onClick={() => setFilterMode("with_architecture")}
                          >
                            <CheckCircle2 />
                            Complets
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant={
                              filterMode === "without_architecture"
                                ? "default"
                                : "outline"
                            }
                            onClick={() => setFilterMode("without_architecture")}
                          >
                            <AlertTriangle />
                            A traiter
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Site</TableHead>
                          <TableHead>Client</TableHead>
                          <TableHead className="text-right">Postes</TableHead>
                          <TableHead className="text-right">Cellules</TableHead>
                          <TableHead className="text-right">Equip.</TableHead>
                          <TableHead className="text-right">Ond.</TableHead>
                          <TableHead>Statut</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {loading ? (
                          <TableRow>
                            <TableCell colSpan={7} className="h-24 text-center">
                              Chargement de l'architecture...
                            </TableCell>
                          </TableRow>
                        ) : filteredSites.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={7} className="h-24 text-center">
                              Aucun site ne correspond aux filtres.
                            </TableCell>
                          </TableRow>
                        ) : (
                          filteredSites.map((site) => (
                            <TableRow
                              key={site.id}
                              className={cn(
                                "cursor-pointer",
                                selectedSiteId === site.id && "bg-muted",
                              )}
                              onClick={() => setSelectedSiteId(site.id)}
                            >
                              <TableCell className="max-w-[260px]">
                                <div className="truncate font-medium">
                                  {site.name}
                                </div>
                                <div className="truncate text-xs text-muted-foreground">
                                  {site.site_code} ·{" "}
                                  {rawSourceValue(site, "idCentrale")}
                                </div>
                              </TableCell>
                              <TableCell>{site.client || "-"}</TableCell>
                              <TableCell className="text-right tabular-nums">
                                {site.poste_count || 0}
                              </TableCell>
                              <TableCell className="text-right tabular-nums">
                                {site.cellule_count || 0}
                              </TableCell>
                              <TableCell className="text-right tabular-nums">
                                {site.equipement_count || 0}
                              </TableCell>
                              <TableCell className="text-right tabular-nums">
                                {site.onduleur_count || 0}
                              </TableCell>
                              <TableCell>
                                {site.has_architecture ? (
                                  <Badge className="rounded-md" variant="secondary">
                                    <CheckCircle2 className="mr-1 h-3 w-3" />
                                    OK
                                  </Badge>
                                ) : (
                                  <Badge className="rounded-md" variant="outline">
                                    <AlertTriangle className="mr-1 h-3 w-3" />
                                    Site-only
                                  </Badge>
                                )}
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
                      {selectedFlatSite?.name || "Détail site"}
                    </CardTitle>
                    <CardDescription>
                      {selectedFlatSite
                        ? `${selectedFlatSite.site_code} · ${selectedFlatSite.client || "client inconnu"}`
                        : "Sélectionner un site pour afficher son arbre"}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {!selectedFlatSite ? (
                      <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
                        Aucun site sélectionné.
                      </div>
                    ) : (
                      <>
                        <div className="grid grid-cols-2 gap-3 text-sm">
                          <div>
                            <div className="text-xs text-muted-foreground">CE</div>
                            <div className="truncate font-medium">
                              {selectedFlatSite.ce || "-"}
                            </div>
                          </div>
                          <div>
                            <div className="text-xs text-muted-foreground">
                              Centrale
                            </div>
                            <div className="truncate font-medium">
                              {rawSourceValue(selectedFlatSite, "idCentrale")}
                            </div>
                          </div>
                          <div>
                            <div className="text-xs text-muted-foreground">
                              Latitude
                            </div>
                            <div className="font-medium tabular-nums">
                              {formatCoordinate(selectedFlatSite.latitude)}
                            </div>
                          </div>
                          <div>
                            <div className="text-xs text-muted-foreground">
                              Longitude
                            </div>
                            <div className="font-medium tabular-nums">
                              {formatCoordinate(selectedFlatSite.longitude)}
                            </div>
                          </div>
                        </div>

                        <div className="rounded-md border p-3">
                          <div className="mb-2 text-xs text-muted-foreground">
                            Adresse
                          </div>
                          <div className="text-sm">
                            {selectedFlatSite.address || "-"}
                          </div>
                        </div>

                        {treeLoading ? (
                          <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
                            Chargement de l'arbre...
                          </div>
                        ) : selectedSite && selectedSite.postes.length > 0 ? (
                          <div className="space-y-3">
                            {selectedSite.postes.map((poste) => (
                              <div key={poste.id} className="rounded-md border">
                                <div className="flex items-center justify-between gap-2 border-b px-3 py-2">
                                  <div className="min-w-0">
                                    <div className="truncate font-medium">
                                      {poste.type_poste || poste.poste_code}
                                    </div>
                                    <div className="text-xs text-muted-foreground">
                                      {poste.poste_code}
                                    </div>
                                  </div>
                                  <Badge variant="outline" className="rounded-md">
                                    {(poste.cellules?.length || 0) +
                                      (poste.equipements?.length || 0) +
                                      (poste.onduleurs?.length || 0)}{" "}
                                    objets
                                  </Badge>
                                </div>
                                <div className="grid grid-cols-1 gap-3 p-3 text-sm">
                                  <TreeGroup
                                    label="Cellules"
                                    values={(poste.cellules || []).map(
                                      (cellule) =>
                                        `${cellule.ordre_cellule || "-"} · ${
                                          cellule.type_cellule ||
                                          cellule.cellule_code
                                        }`,
                                    )}
                                  />
                                  <TreeGroup
                                    label="Equipements"
                                    values={(poste.equipements || []).map(
                                      (equipement) =>
                                        equipement.type_equipement ||
                                        equipement.equipement_code,
                                    )}
                                  />
                                  <TreeGroup
                                    label="Onduleurs"
                                    values={(poste.onduleurs || []).map(
                                      (onduleur) =>
                                        `${onduleur.onduleur_code}${
                                          onduleur.type_onduleur
                                            ? ` · ${onduleur.type_onduleur}`
                                            : ""
                                        }${
                                          onduleur.ip_address
                                            ? ` · ${onduleur.ip_address}`
                                            : ""
                                        }`,
                                    )}
                                  />
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
                            Site présent dans Ignition, mais sans poste dans
                            l'export `Create_Tag`.
                          </div>
                        )}
                      </>
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

function TreeGroup({ label, values }: { label: string; values: string[] }) {
  return (
    <div>
      <div className="mb-1 flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <CircleDot className="h-3 w-3" />
        {label} · {values.length}
      </div>
      {values.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {values.slice(0, 18).map((value, index) => (
            <span
              key={`${value}-${index}`}
              className="max-w-full truncate rounded-md border bg-muted px-2 py-1 text-xs"
              title={value}
            >
              {value}
            </span>
          ))}
          {values.length > 18 && (
            <span className="rounded-md border px-2 py-1 text-xs text-muted-foreground">
              +{values.length - 18}
            </span>
          )}
        </div>
      ) : (
        <div className="text-xs text-muted-foreground">Aucun élément</div>
      )}
    </div>
  );
}

export default withAuth(ArchitecturePage, ["member", "admin", "superadmin"]);
