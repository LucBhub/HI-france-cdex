"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
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
// Imports cleaned

interface ProductionPRChartProps {
  data: {
    timestamp: string;
    energy: number;
  }[];
}

export function ProductionPRChart({ data }: ProductionPRChartProps) {
  const { language } = useLanguage();
  // Format dates for X-Axis
  // Format dates for X-Axis
  const formattedData = data.map((d) => {
    const isMonthly = d.timestamp.length === 7; // "YYYY-MM"
    let dateStr;

    if (isMonthly) {
      // Parse "2025-01" manually to avoid timezone issues or just display as is
      const [year, month] = d.timestamp.split("-");
      dateStr = `${month}/${year}`;
    } else {
      dateStr = new Date(d.timestamp).toLocaleDateString(
        language === "fr" ? "fr-FR" : "en-US",
        {
          day: "2-digit",
          month: "2-digit",
        },
      );
    }

    return {
      ...d,
      dateStr,
    };
  });

  return (
    <Card className="col-span-2">
      <CardHeader>
        <CardTitle>{t("productionTrend", language)}</CardTitle>
        <CardDescription>{t("productionTrendDesc", language)}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={formattedData}>
              <defs>
                <linearGradient id="colorEnergy" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#eab308" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="#eab308" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="dateStr"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                minTickGap={32}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) => `${value} kWh`}
              />
              <Tooltip />
              <Area
                type="monotone"
                dataKey="energy"
                stroke="#eab308"
                fillOpacity={1}
                fill="url(#colorEnergy)"
                name="Energie (kWh)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
