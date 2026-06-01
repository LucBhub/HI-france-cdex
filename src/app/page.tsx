"use client";
import { useEffect, useState } from "react";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { Header } from "@/components/layout/header";
import { Alarms } from "@/components/dashboard/alarms";
import { SidebarProvider } from "@/components/ui/sidebar";
import { SidebarInset } from "@/components/ui/sidebar";
import { DashboardMap } from "@/components/dashboard/dashboard-map";
import { fetchDashboardPlants } from "@/lib/api";
import { type Plant } from "@/lib/data";
import withAuth from "@/components/with-auth";

import { t } from "@/lib/i18n";
import { useLanguage } from "@/contexts/language-context";

function HomePage() {
  const [solarPlants, setSolarPlants] = useState<Plant[]>([]);
  const [loading, setLoading] = useState(true);
  const { language } = useLanguage();

  useEffect(() => {
    let isMounted = true;

    const loadData = async () => {
      try {
        const plantsData = await fetchDashboardPlants();

        if (!isMounted) return;

        setSolarPlants(plantsData);
        setLoading(false);
      } catch (error) {
        if (isMounted) {
          console.error("Dashboard data load error:", error);
        }
      }
    };

    setLoading(true);
    loadData();

    return () => {
      isMounted = false;
    };
  }, []);

  if (loading) {
    return <div>{t("loading", language)}</div>; // Or a proper skeleton loader
  }

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <div className="flex flex-col h-screen">
          <Header solarPlants={solarPlants} />
          <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 h-full">
              <div className="xl:col-span-2 h-full min-h-[500px]">
                <DashboardMap solarPlants={solarPlants} />
              </div>
              <div className="xl:col-span-1 h-full">
                <Alarms />
              </div>
            </div>
          </main>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

export default withAuth(HomePage, ["member", "admin", "superadmin"]);
