"use client";

import { type ReactNode } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  CircleDot,
  Database,
  GitBranch,
  MapPin,
  Network,
  Server,
  ShieldOff,
  Zap,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { type ArchitectureTreeSite } from "@/lib/api";

interface FranceSiteReadOnlyViewProps {
  site: ArchitectureTreeSite;
}

function formatNumber(value: number | string | null | undefined) {
  return new Intl.NumberFormat("fr-FR").format(Number(value || 0));
}

function formatCoordinate(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === "") return "-";
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue.toFixed(5) : "-";
}

function infoValue(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === "") return "-";
  return String(value);
}

function metric(label: string, value: number, icon: ReactNode) {
  return (
    <div className="rounded-md border bg-background p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs text-muted-foreground">{label}</div>
          <div className="mt-1 text-xl font-semibold tabular-nums">
            {formatNumber(value)}
          </div>
        </div>
        <div className="rounded-md bg-muted p-2 text-muted-foreground">
          {icon}
        </div>
      </div>
    </div>
  );
}

function statusLine(
  label: string,
  value: string,
  tone: "ok" | "warning" | "muted",
) {
  const color =
    tone === "ok"
      ? "border-emerald-300 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300"
      : tone === "warning"
        ? "border-amber-300 bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300"
        : "border-muted bg-muted/50 text-muted-foreground";

  return (
    <div className="flex items-center justify-between gap-3 rounded-md border p-3">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className={`rounded-md border px-2 py-1 text-xs font-medium ${color}`}>
        {value}
      </span>
    </div>
  );
}

function compactList(items: Array<{ id: number; label: string; sub?: string | null }>) {
  if (!items.length) {
    return <div className="text-sm text-muted-foreground">Aucun</div>;
  }

  return (
    <div className="space-y-2">
      {items.map((item) => (
        <div
          key={item.id}
          className="flex min-h-9 items-center justify-between gap-2 rounded-md border bg-muted/30 px-2 py-1.5"
        >
          <span className="min-w-0 truncate text-sm font-medium">
            {item.label}
          </span>
          {item.sub && (
            <span className="shrink-0 truncate text-xs text-muted-foreground">
              {item.sub}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

export function FranceSiteReadOnlyView({ site }: FranceSiteReadOnlyViewProps) {
  const postes = site.postes || [];
  const celluleCount = postes.reduce(
    (sum, poste) => sum + (poste.cellules?.length || 0),
    0,
  );
  const equipementCount = postes.reduce(
    (sum, poste) => sum + (poste.equipements?.length || 0),
    0,
  );
  const onduleurCount = postes.reduce(
    (sum, poste) => sum + (poste.onduleurs?.length || 0),
    0,
  );
  const hasArchitecture = site.has_architecture ?? postes.length > 0;

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        <Card className="rounded-md">
          <CardHeader className="space-y-3">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div className="min-w-0">
                <CardTitle className="truncate text-xl">{site.name}</CardTitle>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Badge variant="outline">France Ignition</Badge>
                  <Badge variant="secondary">Lecture seule</Badge>
                  <Badge variant="outline">{site.site_code}</Badge>
                </div>
              </div>
              {hasArchitecture ? (
                <Badge className="w-fit gap-1">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Architecture
                </Badge>
              ) : (
                <Badge variant="destructive" className="w-fit gap-1">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  Site seul
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {metric("Postes", postes.length, <Network className="h-4 w-4" />)}
              {metric("Cellules", celluleCount, <GitBranch className="h-4 w-4" />)}
              {metric(
                "Equipements",
                equipementCount,
                <Server className="h-4 w-4" />,
              )}
              {metric("Onduleurs", onduleurCount, <Zap className="h-4 w-4" />)}
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="rounded-md border p-3">
                <div className="text-xs text-muted-foreground">Client</div>
                <div className="mt-1 truncate text-sm font-medium">
                  {infoValue(site.client)}
                </div>
              </div>
              <div className="rounded-md border p-3">
                <div className="text-xs text-muted-foreground">Charge exploitation</div>
                <div className="mt-1 truncate text-sm font-medium">
                  {infoValue(site.ce)}
                </div>
              </div>
              <div className="rounded-md border p-3">
                <div className="text-xs text-muted-foreground">Adresse</div>
                <div className="mt-1 truncate text-sm font-medium">
                  {infoValue(site.address)}
                </div>
              </div>
              <div className="rounded-md border p-3">
                <div className="text-xs text-muted-foreground">GPS</div>
                <div className="mt-1 truncate text-sm font-medium">
                  {formatCoordinate(site.latitude)}, {formatCoordinate(site.longitude)}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Network className="h-5 w-5 text-muted-foreground" />
            <h2 className="text-lg font-semibold">Architecture site</h2>
          </div>

          {postes.length === 0 ? (
            <div className="rounded-md border bg-muted/30 p-6 text-sm text-muted-foreground">
              Aucun poste importe pour ce site.
            </div>
          ) : (
            <div className="space-y-3">
              {postes.map((poste) => (
                <div key={poste.id} className="rounded-md border bg-card p-4">
                  <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                    <div className="min-w-0">
                      <h3 className="truncate text-base font-semibold">
                        {poste.poste_code}
                      </h3>
                      <div className="mt-1 text-sm text-muted-foreground">
                        {infoValue(poste.type_poste)}
                      </div>
                    </div>
                    <Badge variant="outline" className="w-fit">
                      Ordre {poste.sort_order ?? "-"}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
                    <div>
                      <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase text-muted-foreground">
                        <GitBranch className="h-3.5 w-3.5" />
                        Cellules
                      </div>
                      {compactList(
                        (poste.cellules || []).map((cellule) => ({
                          id: cellule.id,
                          label: cellule.cellule_code,
                          sub: cellule.type_cellule,
                        })),
                      )}
                    </div>
                    <div>
                      <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase text-muted-foreground">
                        <Server className="h-3.5 w-3.5" />
                        Equipements
                      </div>
                      {compactList(
                        (poste.equipements || []).map((equipement) => ({
                          id: equipement.id,
                          label: equipement.equipement_code,
                          sub: equipement.type_equipement,
                        })),
                      )}
                    </div>
                    <div>
                      <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase text-muted-foreground">
                        <Zap className="h-3.5 w-3.5" />
                        Onduleurs
                      </div>
                      {compactList(
                        (poste.onduleurs || []).map((onduleur) => ({
                          id: onduleur.id,
                          label: onduleur.onduleur_code,
                          sub: onduleur.type_onduleur || onduleur.ip_address,
                        })),
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="space-y-6">
        <Card className="rounded-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <CircleDot className="h-5 w-5" />
              Etat exploitation
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {statusLine("Source", "France Ignition", "ok")}
            {statusLine("Telemetry", "Non connecte", "muted")}
            {statusLine("Commandes", "Bloquees", "warning")}
            {statusLine("Polling legacy", "Non utilise", "muted")}
          </CardContent>
        </Card>

        <Card className="rounded-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <ShieldOff className="h-5 w-5" />
              Securite
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <div className="rounded-md border bg-muted/30 p-3">
              Aucune action terrain n'est disponible depuis cette vue.
            </div>
            <div className="rounded-md border bg-muted/30 p-3">
              Les commandes France passent uniquement par le Command Center en
              dry-run.
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Database className="h-5 w-5" />
              Donnees
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-2 rounded-md border p-3 text-sm">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <span className="min-w-0 truncate">{infoValue(site.site_code)}</span>
            </div>
            <div className="rounded-md border p-3 text-sm text-muted-foreground">
              Import local sandbox, sans connexion a BDD_Ignition.
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
