"use client";

import { useEffect, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DashboardCards } from "@/components/reports/DashboardCards";
import { ResolutionStatsChart } from "@/components/reports/ResolutionStatsChart";
import { DecouplingList } from "@/components/reports/DecouplingList";
import { TopProducersChart } from "@/components/reports/TopProducersChart";
import { ProductionPRChart } from "@/components/reports/ProductionPRChart";
import { IncidentsPieChart } from "@/components/reports/IncidentsPieChart";
import { InterventionTable } from "@/components/reports/InterventionTable";
import { IneffectiveInterventions } from "@/components/reports/IneffectiveInterventions";
import { Loader2 } from "lucide-react";

// Layout Imports
import { AppSidebar } from "@/components/layout/app-sidebar";
import { Header } from "@/components/layout/header";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { useLanguage } from "@/contexts/language-context";
import { t } from "@/lib/i18n";

export default function ReportsPage() {
  const { language } = useLanguage();
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [analysisData, setAnalysisData] = useState<any>(null);
  const [timeRange, setTimeRange] = useState<"30days" | "year" | "month">(
    "30days",
  );
  const [selectedMonth, setSelectedMonth] = useState<string>(
    new Date().getMonth().toString(),
  );
  const [selectedYear, setSelectedYear] = useState<string>(
    new Date().getFullYear().toString(),
  );
  const [loading, setLoading] = useState(true);

  const months = [
    { value: "0", label: t("month_0", language) },
    { value: "1", label: t("month_1", language) },
    { value: "2", label: t("month_2", language) },
    { value: "3", label: t("month_3", language) },
    { value: "4", label: t("month_4", language) },
    { value: "5", label: t("month_5", language) },
    { value: "6", label: t("month_6", language) },
    { value: "7", label: t("month_7", language) },
    { value: "8", label: t("month_8", language) },
    { value: "9", label: t("month_9", language) },
    { value: "10", label: t("month_10", language) },
    { value: "11", label: t("month_11", language) },
  ];
  const years = ["2024", "2025", "2026"];

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        const token = localStorage.getItem("authToken");
        const headers = { Authorization: `Bearer ${token}` };

        // Fetch Dashboard Data
        const dashRes = await fetch("/api/reports/dashboard", { headers });
        if (!dashRes.ok) {
          if (dashRes.status === 401) {
            window.location.href = "/login";
            return;
          }
          throw new Error(`Failed to fetch dashboard: ${dashRes.statusText}`);
        }
        const dashJson = await dashRes.json();
        setDashboardData(dashJson);

        // Calculate Date Range
        let queryParams = "";
        if (timeRange === "year") {
          const now = new Date();
          const start = new Date(now.getFullYear(), 0, 1).toISOString(); // Jan 1st
          const end = new Date(now.getFullYear(), 11, 31).toISOString(); // Dec 31st
          queryParams = `?start=${start}&end=${end}&group_by=month`;
        } else if (timeRange === "month") {
          const year = parseInt(selectedYear);
          const month = parseInt(selectedMonth);
          const start = new Date(year, month, 1).toISOString();
          const end = new Date(year, month + 1, 0).toISOString(); // Last day of month
          // For specific month, we probably want daily granularity or just raw data
          queryParams = `?start=${start}&end=${end}`;
        } else {
          // Default 30 days
          const end = new Date();
          const start = new Date();
          start.setDate(end.getDate() - 30);
          queryParams = `?start=${start.toISOString()}&end=${end.toISOString()}`;
        }

        // Fetch Analysis Data
        const analysisRes = await fetch(`/api/reports/analysis${queryParams}`, {
          headers,
        });
        if (!analysisRes.ok) {
          if (analysisRes.status === 401) {
            return;
          }
          throw new Error(
            `Failed to fetch analysis: ${analysisRes.statusText}`,
          );
        }
        const analysisJson = await analysisRes.json();
        setAnalysisData(analysisJson);

        setLoading(false);
      } catch (error) {
        console.error("Failed to fetch reports:", error);
        setLoading(false);
      }
    }

    fetchData();
  }, [timeRange, selectedMonth, selectedYear]);

  // Force update of month labels when language changes (although React might not re-render const months if outside hook, so let's move it inside or use useMemo if strictly needed, but here simple local array re-eval on render is fine)
  // Actually, since months is defined inside the component body, it re-evaluates on every render, capturing the new 'language'. Correct.

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2">{t("loading", language)}</span>
      </div>
    );
  }

  if (!dashboardData || !analysisData) {
    return <div className="p-8 text-center">{t("error", language)}</div>;
  }

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <div className="flex flex-col h-screen">
          <Header solarPlants={[]} />
          <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 space-y-8 animate-in fade-in duration-500">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <h1 className="text-3xl font-bold tracking-tight">
                {t("reportsAnalysis", language)}
              </h1>
              <div className="flex items-center space-x-2">
                {/* Time Range Selector */}
                <Select
                  value={timeRange}
                  onValueChange={(v: any) => setTimeRange(v)}
                >
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder={t("period", language)} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="30days">
                      {t("last30Days", language)}
                    </SelectItem>
                    <SelectItem value="month">
                      {t("monthSpecific", language)}
                    </SelectItem>
                    <SelectItem value="year">
                      {t("currentYear", language)}
                    </SelectItem>
                  </SelectContent>
                </Select>

                {/* Month/Year Selectors (Only visible if 'month' selected) */}
                {timeRange === "month" && (
                  <>
                    <Select
                      value={selectedMonth}
                      onValueChange={setSelectedMonth}
                    >
                      <SelectTrigger className="w-[140px]">
                        <SelectValue placeholder={t("month", language)} />
                      </SelectTrigger>
                      <SelectContent>
                        {months.map((m) => (
                          <SelectItem key={m.value} value={m.value}>
                            {m.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Select
                      value={selectedYear}
                      onValueChange={setSelectedYear}
                    >
                      <SelectTrigger className="w-[100px]">
                        <SelectValue placeholder={t("year", language)} />
                      </SelectTrigger>
                      <SelectContent>
                        {years.map((y) => (
                          <SelectItem key={y} value={y}>
                            {y}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </>
                )}
              </div>
            </div>

            <Tabs defaultValue="dashboard" className="space-y-4">
              <TabsList>
                <TabsTrigger value="dashboard">
                  {t("reportsDashboard", language)}
                </TabsTrigger>
                <TabsTrigger value="details">
                  {t("reportsDetails", language)}
                </TabsTrigger>
              </TabsList>

              <TabsContent value="dashboard" className="space-y-4">
                {/* Top Row: KPIs */}
                <DashboardCards data={dashboardData.kpi} />

                {/* Middle Row: Charts */}
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
                  <div className="col-span-2">
                    <TopProducersChart data={dashboardData.top_producers} />
                  </div>
                  <div className="col-span-3">
                    <ResolutionStatsChart
                      data={analysisData.decoupling_stats}
                    />
                  </div>
                  <div className="col-span-2">
                    <DecouplingList data={dashboardData.worst_offenders} />
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="details" className="space-y-4">
                {/* NEW: Pattern Alerts */}
                {analysisData.patterns && analysisData.patterns.length > 0 && (
                  <div className="grid gap-4 md:grid-cols-1">
                    <IneffectiveInterventions
                      patterns={analysisData.patterns}
                    />
                  </div>
                )}

                <div className="grid gap-4 md:grid-cols-1 lg:grid-cols-3">
                  {/* Row 1: Production & Pie */}
                  <ProductionPRChart data={analysisData.production_trend} />
                  <IncidentsPieChart data={analysisData.incidents_pareto} />

                  {/* Row 2: Table */}
                  <div className="col-span-3">
                    <InterventionTable data={analysisData.interventions} />
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </main>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
