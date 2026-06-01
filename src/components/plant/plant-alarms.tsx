"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Search, ListFilter, Settings2, X } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { type Alarm } from "@/lib/data";
import { cn } from "@/lib/utils";
import { t } from "@/lib/i18n";
import { useLanguage } from "@/contexts/language-context";

type AlarmStatusTab = "active" | "shelved";

const priorityClass = {
  high: "bg-red-200/50 dark:bg-red-900/30 hover:bg-red-200/70 dark:hover:bg-red-900/50",
  medium:
    "bg-orange-200/50 dark:bg-orange-900/30 hover:bg-orange-200/70 dark:hover:bg-orange-900/50",
  low: "bg-yellow-200/50 dark:bg-yellow-900/30 hover:bg-yellow-200/70 dark:hover:bg-yellow-900/50",
  cleared: "",
};

interface PlantAlarmsProps {
  plantId: number;
  initialAlarms: Alarm[];
}

export function PlantAlarms({ plantId, initialAlarms }: PlantAlarmsProps) {
  const { language } = useLanguage();
  const [activeTab, setActiveTab] = useState<AlarmStatusTab>("active");
  const [filters, setFilters] = useState({
    activeUnacknowledged: true,
    priorityLow: true,
    priorityMedium: true,
    priorityHigh: true,
    priorityCritical: true, // Assuming maps to high
  });

  const toggleFilter = (filter: keyof typeof filters) => {
    setFilters((prev) => ({ ...prev, [filter]: !prev[filter] }));
  };

  const removeAllFilters = () => {
    setFilters({
      activeUnacknowledged: false,
      priorityLow: false,
      priorityMedium: false,
      priorityHigh: false,
      priorityCritical: false,
    });
  };

  const filteredAlarms = initialAlarms.filter((alarm) => {
    if (activeTab === "active") {
      let priorityMatch = false;
      if (filters.priorityLow && alarm.priority === "low") priorityMatch = true;
      if (filters.priorityMedium && alarm.priority === "medium")
        priorityMatch = true;
      if (filters.priorityHigh && alarm.priority === "high")
        priorityMatch = true;
      if (filters.priorityCritical && alarm.priority === "high")
        priorityMatch = true;

      let statusMatch = false;
      if (
        filters.activeUnacknowledged &&
        (alarm.status === "active" || alarm.status === "unacknowledged")
      ) {
        statusMatch = true;
      }

      return alarm.status !== "shelved" && priorityMatch && statusMatch;
    }
    if (activeTab === "shelved") {
      return alarm.status === "shelved";
    }
    return false;
  });

  const activeAlarmsCount = initialAlarms.filter(
    (a) => a.status === "active" || a.status === "unacknowledged",
  ).length;
  const shelvedAlarmsCount = initialAlarms.filter(
    (a) => a.status === "shelved",
  ).length;

  const AlarmRow = ({ alarm }: { alarm: Alarm }) => {
    const [formattedDate, setFormattedDate] = useState("");

    useEffect(() => {
      const date = new Date(alarm.timestamp);
      setFormattedDate(
        `${(date.getMonth() + 1).toString().padStart(2, "0")}/${date.getDate().toString().padStart(2, "0")}/${date.getFullYear()} ${date.getHours().toString().padStart(2, "0")}:${date.getMinutes().toString().padStart(2, "0")}:${date.getSeconds().toString().padStart(2, "0")}`,
      );
    }, [alarm.timestamp]);

    return (
      <TableRow className={cn(priorityClass[alarm.priority] || "")}>
        <TableCell className="text-center">
          <Checkbox />
        </TableCell>
        <TableCell>{formattedDate}</TableCell>
        <TableCell>{alarm.label}</TableCell>
        <TableCell>{alarm.name}</TableCell>
      </TableRow>
    );
  };

  const activeFiltersCount = Object.values(filters).filter(Boolean).length;

  return (
    <Card className="h-full flex flex-col">
      <CardContent className="flex-1 flex flex-col p-0">
        <Tabs
          defaultValue="active"
          className="flex-1 flex flex-col"
          onValueChange={(value) => setActiveTab(value as AlarmStatusTab)}
        >
          <div className="flex items-center justify-between p-2 border-b">
            <TabsList className="grid grid-cols-2">
              <TabsTrigger value="active">
                {activeAlarmsCount} {t("active", language).toUpperCase()}
              </TabsTrigger>
              <TabsTrigger value="shelved">
                {shelvedAlarmsCount} {t("shelved", language).toUpperCase()}
              </TabsTrigger>
            </TabsList>
            <div className="flex items-center gap-2">
              <Search className="h-5 w-5 text-muted-foreground" />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <ListFilter className="h-5 w-5 text-muted-foreground" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>
                    {t("filterByStatus", language)}
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuCheckboxItem
                    checked={filters.activeUnacknowledged}
                    onCheckedChange={() => toggleFilter("activeUnacknowledged")}
                  >
                    {t("activeUnacknowledged", language)}
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuLabel>
                    {t("filterByPriority", language)}
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuCheckboxItem
                    checked={filters.priorityLow}
                    onCheckedChange={() => toggleFilter("priorityLow")}
                  >
                    {t("priorityLow", language)}
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem
                    checked={filters.priorityMedium}
                    onCheckedChange={() => toggleFilter("priorityMedium")}
                  >
                    {t("priorityMedium", language)}
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem
                    checked={filters.priorityHigh}
                    onCheckedChange={() => toggleFilter("priorityHigh")}
                  >
                    {t("priorityHigh", language)}
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem
                    checked={filters.priorityCritical}
                    onCheckedChange={() => toggleFilter("priorityCritical")}
                  >
                    {t("priorityCritical", language)}
                  </DropdownMenuCheckboxItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Settings2 className="h-5 w-5 text-muted-foreground" />
            </div>
          </div>

          {activeFiltersCount > 0 && (
            <div className="p-2 border-b flex items-center justify-between flex-wrap">
              <div className="flex gap-1 flex-wrap items-center">
                <Badge variant="outline" className="text-xs font-normal">
                  {t("filters", language)} ({activeFiltersCount}):
                </Badge>
                {filters.activeUnacknowledged && (
                  <Badge variant="outline" className="text-xs font-normal">
                    {t("activeUnacknowledged", language)}{" "}
                    <X
                      className="ml-2 h-3 w-3 cursor-pointer"
                      onClick={() => toggleFilter("activeUnacknowledged")}
                    />
                  </Badge>
                )}
                {filters.priorityLow && (
                  <Badge variant="outline" className="text-xs font-normal">
                    {t("priorityLow", language)}{" "}
                    <X
                      className="ml-2 h-3 w-3 cursor-pointer"
                      onClick={() => toggleFilter("priorityLow")}
                    />
                  </Badge>
                )}
                {filters.priorityMedium && (
                  <Badge variant="outline" className="text-xs font-normal">
                    {t("priorityMedium", language)}{" "}
                    <X
                      className="ml-2 h-3 w-3 cursor-pointer"
                      onClick={() => toggleFilter("priorityMedium")}
                    />
                  </Badge>
                )}
                {filters.priorityHigh && (
                  <Badge variant="outline" className="text-xs font-normal">
                    {t("priorityHigh", language)}{" "}
                    <X
                      className="ml-2 h-3 w-3 cursor-pointer"
                      onClick={() => toggleFilter("priorityHigh")}
                    />
                  </Badge>
                )}
                {filters.priorityCritical && (
                  <Badge variant="outline" className="text-xs font-normal">
                    {t("priorityCritical", language)}{" "}
                    <X
                      className="ml-2 h-3 w-3 cursor-pointer"
                      onClick={() => toggleFilter("priorityCritical")}
                    />
                  </Badge>
                )}
              </div>
              <Button
                variant="destructive"
                size="sm"
                onClick={removeAllFilters}
                className="mt-2 sm:mt-0"
              >
                {t("removeAll", language)}
              </Button>
            </div>
          )}

          <div className="flex-1 overflow-y-auto">
            <TabsContent value="active" className="m-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px] text-center">
                      <Checkbox />
                    </TableHead>
                    <TableHead>{t("activeTime", language)}</TableHead>
                    <TableHead>{t("label", language)}</TableHead>
                    <TableHead>{t("name", language)}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAlarms.length > 0 ? (
                    filteredAlarms.map((alarm) => (
                      <AlarmRow key={alarm.id} alarm={alarm} />
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={4} className="h-24 text-center">
                        {t("noActiveAlarms", language)}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TabsContent>
            <TabsContent value="shelved" className="m-0">
              <div className="p-4 text-center text-muted-foreground">
                {t("noShelvedAlarms", language)}
              </div>
            </TabsContent>
          </div>
        </Tabs>
      </CardContent>
    </Card>
  );
}
