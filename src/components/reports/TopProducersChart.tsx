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

interface TopProducersProps {
  data: {
    name: string;
    production: number;
    yield?: number; // Optional as older cached data might not have it instantly
  }[];
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-popover text-popover-foreground rounded-lg border p-2 shadow-md">
        <p className="font-semibold">{data.name}</p>
        <div className="text-sm">
          <span className="text-muted-foreground">Production: </span>
          <span className="font-medium">
            {(data.production / 1000).toFixed(2)} MWh
          </span>
        </div>
        {data.yield !== undefined && (
          <div className="text-sm">
            <span className="text-muted-foreground">Performance: </span>
            <span className="font-medium text-emerald-600">
              {parseFloat(data.yield).toFixed(1)} kWh/kWc
            </span>
          </div>
        )}
      </div>
    );
  }
  return null;
};

export function TopProducersChart({ data }: TopProducersProps) {
  const { language } = useLanguage();
  return (
    <Card className="col-span-1">
      <CardHeader>
        <CardTitle>{t("topProducers", language)}</CardTitle>
        <CardDescription>{t("topProducersDesc", language)}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[200px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" hide />
              <YAxis
                dataKey="name"
                type="category"
                width={100}
                tick={{ fontSize: 12 }}
              />
              <Tooltip
                content={<CustomTooltip />}
                cursor={{ fill: "transparent" }}
              />
              <Bar
                dataKey="production"
                fill="#eab308"
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
