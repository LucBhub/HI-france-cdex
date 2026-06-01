"use client";

import { useState } from "react";
import { type Plant } from "@/lib/data";
import { useAnalysisData } from "@/hooks/use-analysis-data";
import { useChartConfig, ChartRange } from "@/hooks/use-chart-config";
import { format, subDays, addDays, startOfDay } from "date-fns";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Loader2,
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import {
  ComposedChart,
  Line,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Brush,
} from "recharts";
import { t } from "@/lib/i18n";

interface AnalysisViewProps {
  plant: Plant;
}

export function AnalysisView({ plant }: AnalysisViewProps) {
  const [range, setRange] = useState<ChartRange>("day");
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const { data, loading } = useAnalysisData(plant.id, range, selectedDate);

  // Toggles
  const [toggles, setToggles] = useState({
    power: true,
    irradiation: true,
    voltage: false,
    current: false,
  });

  const {
    formatXAxis,
    formatTooltipLabel,
    formatTooltipValue,
    colors,
    language,
  } = useChartConfig();

  const handlePrevDay = () => setSelectedDate((prev) => subDays(prev, 1));
  const handleNextDay = () => setSelectedDate((next) => addDays(next, 1));
  const toggle = (key: keyof typeof toggles) =>
    setToggles((p) => ({ ...p, [key]: !p[key] }));

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
        <div className="space-y-1">
          <CardTitle>{t("analysisHistory", language)}</CardTitle>
          <CardDescription>{t("analysisSubtitle", language)}</CardDescription>
        </div>
        <div className="flex items-center space-x-2">
          {range === "day" && (
            <div className="flex items-center space-x-1 mr-2">
              <Button variant="outline" size="icon" onClick={handlePrevDay}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant={"outline"}
                    className={cn(
                      "w-[240px] justify-start text-left font-normal",
                      !selectedDate && "text-muted-foreground",
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {selectedDate ? (
                      format(selectedDate, "PPP")
                    ) : (
                      <span>Pick a date</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end">
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={(d) => d && setSelectedDate(d)}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              <Button
                variant="outline"
                size="icon"
                onClick={handleNextDay}
                disabled={
                  startOfDay(selectedDate).getTime() ===
                  startOfDay(new Date()).getTime()
                }
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}

          <Select value={range} onValueChange={(v: ChartRange) => setRange(v)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder={t("period", language)} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="24h">{t("last24h", language)}</SelectItem>
              <SelectItem value="day">
                {t("today", language)} / Custom
              </SelectItem>
              <SelectItem value="7d">{t("last7d", language)}</SelectItem>
              <SelectItem value="30d">{t("last30d", language)}</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" disabled={loading}>
            <span className={loading ? "animate-spin" : ""}>↻</span>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col min-h-[400px]">
        <div className="flex items-center gap-4 mb-4 text-sm">
          <span className="font-semibold text-muted-foreground mr-2">
            {t("show", language)}
          </span>
          <ToggleButton
            active={toggles.power}
            onClick={() => toggle("power")}
            label={t("powerUnit", language)}
            color="green"
          />
          <ToggleButton
            active={toggles.irradiation}
            onClick={() => toggle("irradiation")}
            label={t("irradiationUnit", language)}
            color="orange"
          />
          <ToggleButton
            active={toggles.voltage}
            onClick={() => toggle("voltage")}
            label={t("voltageUnit", language)}
            color="blue"
          />
          <ToggleButton
            active={toggles.current}
            onClick={() => toggle("current")}
            label={t("currentUnit", language)}
            color="purple"
          />
        </div>

        <div className="flex-1 w-full min-h-0">
          {loading && data.length === 0 ? (
            <div className="flex h-full items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                key={range}
                data={data}
                margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="colorPower" x1="0" y1="0" x2="0" y2="1">
                    <stop
                      offset="5%"
                      stopColor={colors.power.stroke}
                      stopOpacity={0.8}
                    />
                    <stop
                      offset="95%"
                      stopColor={colors.power.stroke}
                      stopOpacity={0}
                    />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="time"
                  type="number"
                  scale="time"
                  domain={["auto", "auto"]}
                  tickFormatter={(t) => formatXAxis(t, range)}
                />
                <YAxis
                  yAxisId="left"
                  orientation="left"
                  stroke={colors.power.stroke}
                  label={{
                    value: t("powerUnit", language),
                    angle: -90,
                    position: "insideLeft",
                  }}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  stroke={colors.irradiation.stroke}
                  label={{
                    value: t("irradiationUnit", language),
                    angle: 90,
                    position: "insideRight",
                  }}
                />

                <Tooltip
                  contentStyle={{
                    backgroundColor: "white",
                    borderRadius: "8px",
                    border: "1px solid #e5e7eb",
                  }}
                  labelFormatter={formatTooltipLabel}
                  formatter={formatTooltipValue}
                />
                <Legend verticalAlign="top" />

                {toggles.irradiation && (
                  <Area
                    yAxisId="right"
                    type="monotone"
                    dataKey="irradiation"
                    stroke={colors.irradiation.stroke}
                    fill={colors.irradiation.fill}
                    fillOpacity={0.1}
                    strokeDasharray="5 5"
                    name={t("irradiation", language)}
                    connectNulls
                  />
                )}
                {toggles.power && (
                  <Area
                    yAxisId="left"
                    type="monotone"
                    dataKey="power"
                    stroke={colors.power.stroke}
                    fillOpacity={1}
                    fill={colors.power.fill}
                    name={t("production", language)}
                  />
                )}
                {toggles.voltage && (
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="voltage"
                    stroke={colors.voltage.stroke}
                    dot={false}
                    name={t("voltage", language)}
                    connectNulls
                  />
                )}
                {toggles.current && (
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="current"
                    stroke={colors.current.stroke}
                    dot={false}
                    name={t("current", language)}
                    connectNulls
                  />
                )}

                <Brush
                  dataKey="time"
                  height={30}
                  stroke="#8884d8"
                  tickFormatter={(t) => formatXAxis(t, range)}
                />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// Extracted sub-component for cleaner JSX
function ToggleButton({
  active,
  onClick,
  label,
  color,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  color: string;
}) {
  const baseClass = `border-${color}-300 text-${color}-700 hover:text-${color}-800 hover:bg-${color}-100`;
  const activeClass = active ? `bg-${color}-100` : "";

  return (
    <Button
      variant={active ? "outline" : "ghost"}
      onClick={onClick}
      className={`${baseClass} ${activeClass}`}
    >
      {label}
    </Button>
  );
}
