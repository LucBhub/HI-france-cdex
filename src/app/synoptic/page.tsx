"use client";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { Header } from "@/components/layout/header";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import withAuth from "@/components/with-auth";
import { useEffect, useState } from "react";
import { fetchPlants } from "@/lib/api";
import { Plant } from "@/lib/data";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Search, Sun } from "lucide-react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";

import { t } from "@/lib/i18n";
import { useLanguage } from "@/contexts/language-context";

// ... imports

function SynopticPage() {
  const [plants, setPlants] = useState<Plant[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
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

  const filteredPlants = plants.filter((plant) =>
    plant.name.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <div className="flex flex-col h-screen">
          <Header solarPlants={plants} />
          <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
            <div className="max-w-4xl mx-auto">
              <h1 className="text-2xl font-bold mb-6">
                {t("synopticTitle", language)}
              </h1>

              <div className="relative mb-6">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input
                  placeholder={t("searchPlantPlaceholder", language)}
                  className="pl-10 text-base"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>

              {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <Skeleton className="h-24 w-full" />
                  <Skeleton className="h-24 w-full" />
                  <Skeleton className="h-24 w-full" />
                  <Skeleton className="h-24 w-full" />
                  <Skeleton className="h-24 w-full" />
                  <Skeleton className="h-24 w-full" />
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredPlants.length > 0 ? (
                    filteredPlants.map((plant) => (
                      <Link key={plant.id} href={`/plant/${plant.id}`} passHref>
                        <Card className="hover:bg-accent hover:text-accent-foreground transition-colors cursor-pointer h-full">
                          <CardContent className="flex items-center gap-4 p-4">
                            <div className="p-3 bg-primary/20 rounded-lg">
                              <Sun className="h-6 w-6 text-primary" />
                            </div>
                            <div className="flex-1">
                              <p className="font-semibold">{plant.name}</p>
                              <p className="text-sm text-muted-foreground">
                                {plant.powerKwc} kWc
                              </p>
                            </div>
                          </CardContent>
                        </Card>
                      </Link>
                    ))
                  ) : (
                    <div className="col-span-full text-center text-muted-foreground py-10">
                      {t("noPlantsFound", language)}
                    </div>
                  )}
                </div>
              )}
            </div>
          </main>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

export default withAuth(SynopticPage, ["member", "admin", "superadmin"]);
