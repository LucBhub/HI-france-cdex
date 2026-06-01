"use client";

import {
  Bar,
  BarChart,
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

interface IncidentsPieChartProps {
  data: {
    fault_type: string;
    count: number;
  }[];
}

const COLORS = [
  "#0088FE",
  "#00C49F",
  "#FFBB28",
  "#FF8042",
  "#f43f5e",
  "#8b5cf6",
  "#ec4899",
  "#6366f1",
];

export function IncidentsPieChart({ data }: IncidentsPieChartProps) {
  const { language } = useLanguage();
  // Use "Pareto" logic: keep top 5, group others as "Autres"
  const sortedData = [...data].sort((a, b) => b.count - a.count);
  const top5 = sortedData.slice(0, 5);
  const others = sortedData.slice(5).reduce((acc, curr) => acc + curr.count, 0);

  const chartData = [
    ...top5,
    ...(others > 0 ? [{ fault_type: "Autres", count: others }] : []),
  ];

  return (
    <Card className="col-span-1 border-muted/40 shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-medium">
          {t("faultTypes", language)}
        </CardTitle>
        <CardDescription>{t("faultTypesDesc", language)}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[300px] w-full mt-2">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              layout="vertical"
              margin={{ top: 5, right: 30, left: 40, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" />
              <YAxis
                dataKey="fault_type"
                type="category"
                width={100}
                tick={{ fontSize: 12 }}
              />
              <Tooltip
                cursor={{ fill: "transparent" }}
                contentStyle={{
                  borderRadius: "8px",
                  border: "none",
                  boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                }}
              />
              <Bar
                dataKey="count"
                fill="#3b82f6"
                radius={[0, 4, 4, 0]}
                barSize={20}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
