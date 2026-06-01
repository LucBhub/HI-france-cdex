import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, Zap, AlertTriangle, Wrench } from "lucide-react";
import { useLanguage } from "@/contexts/language-context";
import { t } from "@/lib/i18n";

interface DashboardCardsProps {
  data: {
    availability: number;
    total_energy_mwh: number;
    active_incidents: number;
    interventions_24h: number;
  };
}

export function DashboardCards({ data }: DashboardCardsProps) {
  const { language } = useLanguage();
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">
            {t("globalAvailability", language)}
          </CardTitle>
          <Activity className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{data.availability}%</div>
          <p className="text-xs text-muted-foreground">
            Temps de fonctionnement (Est.)
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">
            {t("production30d", language)}
          </CardTitle>
          <Zap className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{data.total_energy_mwh} MWh</div>
          <p className="text-xs text-muted-foreground">
            Energie produite totale
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">
            {t("activeIncidents", language)}
          </CardTitle>
          <AlertTriangle className="h-4 w-4 text-red-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-red-500">
            {data.active_incidents}
          </div>
          <p className="text-xs text-muted-foreground">
            Nécessitant une attention
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">
            {t("interventions24h", language)}
          </CardTitle>
          <Wrench className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{data.interventions_24h}</div>
          <p className="text-xs text-muted-foreground">
            Actions opérateurs récentes
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
