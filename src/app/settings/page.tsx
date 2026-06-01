"use client";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { Header } from "@/components/layout/header";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { PlantSettings } from "@/components/settings/plant-settings";
import { DeviceModelsSettings } from "@/components/settings/device-models-settings";
import { AuditLogsTable } from "@/components/settings/audit-logs-table";
import { DataManagementTab } from "@/components/settings/data-management-tab";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { fetchPlants } from "@/lib/api";
import withAuth from "@/components/with-auth";
import { useEffect, useState } from "react";
import { Plant } from "@/lib/data";
import { Skeleton } from "@/components/ui/skeleton";

import { t } from "@/lib/i18n";
import { useLanguage } from "@/contexts/language-context";

// ... imports

function SettingsPage() {
  const [plants, setPlants] = useState<Plant[]>([]);
  const [loading, setLoading] = useState(true);
  const { language } = useLanguage();

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      const plantsData = await fetchPlants();
      setPlants(plantsData);
      setLoading(false);
    }
    loadData();
  }, []);

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <div className="flex flex-col h-screen">
          <Header solarPlants={plants} />
          <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
            {loading ? (
              <div className="max-w-4xl mx-auto space-y-8">
                <Skeleton className="h-10 w-48" />
                <Skeleton className="h-64 w-full" />
                <Skeleton className="h-64 w-full" />
              </div>
            ) : (
              <div className="max-w-4xl mx-auto">
                <h1 className="text-3xl font-bold mb-8">
                  {t("settings", language)}
                </h1>

                <Tabs defaultValue="plants" className="space-y-4">
                  <TabsList>
                    <TabsTrigger value="plants">
                      {t("plants", language)}
                    </TabsTrigger>
                    <TabsTrigger value="device-models">
                      {t("deviceModels", language)}
                    </TabsTrigger>
                    <TabsTrigger value="audit-logs">
                      {t("auditLogs", language)}
                    </TabsTrigger>
                    <TabsTrigger value="data">
                      {t("data", language)}
                    </TabsTrigger>
                  </TabsList>
                  <TabsContent value="plants">
                    <PlantSettings initialPlants={plants} />
                  </TabsContent>
                  <TabsContent value="device-models">
                    <DeviceModelsSettings />
                  </TabsContent>
                  <TabsContent value="audit-logs">
                    <AuditLogsTable />
                  </TabsContent>
                  <TabsContent value="data">
                    <DataManagementTab />
                  </TabsContent>
                </Tabs>
              </div>
            )}
          </main>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

export default withAuth(SettingsPage, ["admin", "superadmin"]);
