"use client";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { type Plant } from "@/lib/data";
import {
  Zap,
  Activity,
  CircleGauge,
  BarChartHorizontalBig,
} from "lucide-react";

interface DiagnosticsCardProps {
  plant: Plant;
}

const DiagnosticItem = ({
  icon,
  label,
  value,
  unit,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string | undefined;
  unit: string;
}) => (
  <div className="flex items-start gap-4">
    <div className="bg-muted rounded-lg p-2">{icon}</div>
    <div>
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="text-lg font-bold">
        {/* Ensure value is a number before calling toFixed, default to 0 */}
        {typeof value === "number" ? value.toFixed(2) : (0).toFixed(2)}{" "}
        <span className="text-sm font-normal text-muted-foreground">
          {unit}
        </span>
      </p>
    </div>
  </div>
);

import { t } from "@/lib/i18n";
import { useLanguage } from "@/contexts/language-context";

// ... imports

export function DiagnosticsCard({ plant }: DiagnosticsCardProps) {
  const { language } = useLanguage();

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="text-center text-lg font-medium">
          {t("realTimeDiagnostics", language)}
        </CardTitle>
        <CardDescription className="text-center">
          {t("liveDataRelay", language)}
        </CardDescription>
      </CardHeader>
      <CardContent className="grid grid-cols-2 md:grid-cols-3 gap-6 text-sm">
        <DiagnosticItem
          icon={<BarChartHorizontalBig className="h-6 w-6 text-primary" />}
          label={t("totalEnergy", language)}
          value={plant.totalEnergy}
          unit="kWh"
        />
        <DiagnosticItem
          icon={<Activity className="h-6 w-6 text-primary" />}
          label={t("frequency", language)}
          value={plant.frequency}
          unit="Hz"
        />

        <div className="col-span-2 md:col-span-3 border-t my-2"></div>

        <DiagnosticItem
          icon={<CircleGauge className="h-6 w-6 text-yellow-500" />}
          label={t("currentL1", language)}
          value={plant.currentL1}
          unit="A"
        />
        <DiagnosticItem
          icon={<CircleGauge className="h-6 w-6 text-orange-500" />}
          label={t("currentL2", language)}
          value={plant.currentL2}
          unit="A"
        />
        <DiagnosticItem
          icon={<CircleGauge className="h-6 w-6 text-red-500" />}
          label={t("currentL3", language)}
          value={plant.currentL3}
          unit="A"
        />

        <div className="col-span-2 md:col-span-3 border-t my-2"></div>

        <DiagnosticItem
          icon={<Zap className="h-6 w-6 text-yellow-500" />}
          label={t("voltageU12", language)}
          value={plant.voltageU12}
          unit="V"
        />
        <DiagnosticItem
          icon={<Zap className="h-6 w-6 text-orange-500" />}
          label={t("voltageU23", language)}
          value={plant.voltageU23}
          unit="V"
        />
        <DiagnosticItem
          icon={<Zap className="h-6 w-6 text-red-500" />}
          label={t("voltageU31", language)}
          value={plant.voltageU31}
          unit="V"
        />
      </CardContent>
    </Card>
  );
}
