"use client";

import {
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useLanguage } from "@/contexts/language-context";
import { t } from "@/lib/i18n";

interface ResolutionStatsProps {
  data: {
    total_decouplings: number;
    remote_recouplings: number;
    unresolved_remotely: number;
  };
}

const COLORS = ["#22c55e", "#ef4444"];

export function ResolutionStatsChart({ data }: ResolutionStatsProps) {
  const { language } = useLanguage();
  const chartData = [
    { name: "Recouplage Distance", value: data.remote_recouplings },
    { name: "Terrain / Non Résolu", value: data.unresolved_remotely },
  ];

  return (
    <Card className="col-span-1 border-muted/40 shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-medium">
          {t("remoteControlEfficiency", language)}
        </CardTitle>
        <CardDescription>
          {t("remoteControlDesc", language).replace(
            "{0}",
            data.total_decouplings.toString(),
          )}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[300px] w-full mt-4">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={80}
                paddingAngle={5}
                dataKey="value"
              >
                {chartData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={COLORS[index % COLORS.length]}
                  />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  borderRadius: "8px",
                  border: "none",
                  boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                }}
              />
              <Legend verticalAlign="bottom" height={36} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="flex justify-center gap-4 mt-2 text-sm text-center">
          <div>
            <p className="font-semibold text-green-500">
              {data.remote_recouplings}
            </p>
            <p className="text-muted-foreground text-xs">
              {t("success", language)}
            </p>
          </div>
          <div>
            <p className="font-semibold text-red-500">
              {data.unresolved_remotely}
            </p>
            <p className="text-muted-foreground text-xs">
              {t("failureField", language)}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
