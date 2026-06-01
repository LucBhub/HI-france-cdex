"use client";
import { t } from "@/lib/i18n";
import { useLanguage } from "@/contexts/language-context";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { Header } from "@/components/layout/header";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { useParams, notFound } from "next/navigation";
import { fetchPlantById, fetchPlants } from "@/lib/api";
import { type Plant } from "@/lib/data";

import { GeneralInfoCard } from "@/components/plant/general-info-card";
import { ThytronicRelayCard } from "@/components/plant/thytronic-relay-card";
import { PowerControlCard } from "@/components/plant/power-control-card";
import { PlantMapCard } from "@/components/plant/plant-map-card";
import { MaintenanceToggle } from "@/components/plant/maintenance-toggle";
import { AnalysisView } from "@/components/plant/analysis-view";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import withAuth from "@/components/with-auth";
import { useEffect, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";

function PlantPage() {
  const params = useParams();
  const id = params.id;
  const plantId = parseInt(id as string);
  const { language } = useLanguage();

  const [plant, setPlant] = useState<Plant | null | undefined>(undefined);
  const [allPlants, setAllPlants] = useState<Plant[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isNaN(plantId)) {
      setPlant(null);
      setLoading(false);
      return;
    }

    let isMounted = true;
    let intervalId: ReturnType<typeof setInterval> | undefined;

    const loadData = async () => {
      try {
        const [plantData, allPlantsData] = await Promise.all([
          fetchPlantById(plantId),
          fetchPlants(),
        ]);

        if (!isMounted) {
          return;
        }

        setPlant(plantData);
        setAllPlants(allPlantsData);
        setLoading(false);
      } catch (error) {
        if (isMounted) {
          console.error(`Failed to refresh plant ${plantId}:`, error);
        }
      }
    };

    loadData();
    intervalId = setInterval(loadData, 1000);

    return () => {
      isMounted = false;
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [plantId]);

  if (loading) {
    return (
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          <div className="flex flex-col h-screen">
            <Header solarPlants={[]} />
            <main className="flex-1 p-8">
              <Skeleton className="w-full h-64" />
            </main>
          </div>
        </SidebarInset>
      </SidebarProvider>
    );
  }

  if (!plant) {
    notFound();
  }

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <div className="flex flex-col h-screen bg-muted/40">
          <Header solarPlants={allPlants} />
          <Tabs defaultValue="synoptic" className="w-full">
            <div className="px-4 md:px-6 lg:px-8">
              <TabsList className="grid w-full grid-cols-2 max-w-[400px]">
                <TabsTrigger value="synoptic">
                  {t("synoptic", language)}
                </TabsTrigger>
                <TabsTrigger value="analysis">
                  {t("analysisHistory", language)}
                </TabsTrigger>
              </TabsList>
            </div>

            <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 space-y-6">
              <TabsContent value="synoptic" className="space-y-6 mt-0">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <div className="lg:col-span-2 space-y-6">
                    <GeneralInfoCard plant={plant} />
                    <div className="space-y-4">
                      <h3 className="text-lg font-semibold">
                        {t("thytronicRelays", language)}
                      </h3>
                      {plant.relays && plant.relays.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {plant.relays.map((relay) => (
                            <ThytronicRelayCard
                              key={relay.id}
                              relay={relay}
                              plantId={plant.id}
                            />
                          ))}
                        </div>
                      ) : (
                        <div className="p-4 border rounded-lg bg-muted/50 text-center text-muted-foreground">
                          {t("noRelays", language)}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="lg:col-span-1 space-y-6">
                    <MaintenanceToggle plant={plant} />
                    <PowerControlCard plant={plant} />
                    <PlantMapCard plant={plant} />
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="analysis" className="h-[800px] mt-0">
                <AnalysisView plant={plant} />
              </TabsContent>
            </main>
          </Tabs>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

export default withAuth(PlantPage, ["member", "admin", "superadmin"]);
