"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  ShieldAlert,
  ShieldCheck,
  ShieldQuestion,
  CircleAlert,
  RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { t } from "@/lib/i18n";
import { useLanguage } from "@/contexts/language-context";

interface Alarm {
  id: string;
  type: "fault" | "breaker";
  plantId: number;
  plantName: string;
  relayId: number;
  relayName: string;
  priority: "high" | "medium" | "low";
  status: "active" | "unacknowledged";
  message: string;
  messageKey?: string;
  faultType?: string;
  timestamp: string;
  faultCounter?: number;
  acknowledged?: boolean;
}

type AlarmStatus = "active" | "acknowledged";

const priorityIcons = {
  high: <ShieldAlert className="h-5 w-5 text-red-500" />,
  medium: <CircleAlert className="h-5 w-5 text-orange-500" />,
  low: <ShieldQuestion className="h-5 w-5 text-yellow-500" />,
  cleared: <ShieldCheck className="h-5 w-5 text-green-500" />,
};

const priorityBadgeVariant = {
  high: "destructive" as const,
  medium: "default" as const,
  low: "secondary" as const,
  cleared: "outline" as const,
};

const priorityBadgeClass = {
  medium: "bg-orange-500 hover:bg-orange-500/80 text-white",
};

export function Alarms() {
  const [activeTab, setActiveTab] = useState<AlarmStatus>("active");
  const [alarms, setAlarms] = useState<Alarm[]>([]);
  const [loading, setLoading] = useState(true);
  const { language } = useLanguage();

  const fetchAlarms = async () => {
    try {
      const token = localStorage.getItem("authToken");
      const url = `/api/alarms`;

      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setAlarms(data);
      } else {
        console.error("[Alarms] Response not OK:", response.status);
      }
    } catch (error) {
      console.error("[Alarms] Error fetching alarms:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAlarms();
    // Refresh every 30 seconds
    const interval = setInterval(fetchAlarms, 30000);
    return () => clearInterval(interval);
  }, []);

  const filteredAlarms = alarms.filter((alarm) => {
    if (activeTab === "active") {
      return alarm.status === "active" && !alarm.acknowledged;
    }
    if (activeTab === "acknowledged") {
      return alarm.acknowledged === true;
    }
    return false;
  });

  const activeAlarmsCount = alarms.filter(
    (a) => a.status === "active" && !a.acknowledged,
  ).length;
  const acknowledgedAlarmsCount = alarms.filter(
    (a) => a.acknowledged === true,
  ).length;

  const AlarmItem = ({ alarm }: { alarm: Alarm }) => {
    const [formattedDate, setFormattedDate] = useState("");

    useEffect(() => {
      try {
        const date = new Date(alarm.timestamp);
        setFormattedDate(
          date.toLocaleString("fr-FR", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          }),
        );
      } catch (e) {
        setFormattedDate(alarm.timestamp);
      }
    }, [alarm.timestamp]);

    // Translation Logic
    let displayMessage = alarm.message;

    // 1. Priority: Detailed Fault Translation (if faultType exists)
    if (alarm.type === "fault" && alarm.faultType) {
      // Map common fault strings to keys
      const faultMap: Record<string, string> = {
        "Défaut non déterminable": "fault_unknown",
        "Court-circuit phase L1 vers terre": "fault_l1_earth",
        "Court-circuit phase L2 vers terre": "fault_l2_earth",
        "Court-circuit phase L3 vers terre": "fault_l3_earth",
        "Court-circuit entre phases L1-L2": "fault_l1_l2",
        "Court-circuit entre phases L2-L3": "fault_l2_l3",
        "Court-circuit entre phases L3-L1": "fault_l3_l1",
        "Court-circuit phases L1-L2 vers terre": "fault_l1_l2_earth",
        "Court-circuit phases L3-L1 vers terre": "fault_l3_l1_earth",
        "Court-circuit phases L2-L3 vers terre": "fault_l2_l3_earth",
        "Court-circuit triphasé L1-L2-L3": "fault_l1_l2_l3",
        "Court-circuit triphasé vers terre": "fault_tri_earth",
        Unknown: "fault_unknown",
      };

      const faultKey = faultMap[alarm.faultType];
      if (faultKey) {
        const translatedFault = t(faultKey, language);
        // Use messageKey for prefix if available (e.g. "Incident Detected"), or hardcode/fallback
        const prefixKey = alarm.messageKey || "incident_detected";
        const prefix = t(prefixKey, language);
        displayMessage = `${prefix}: ${translatedFault}`;
      } else {
        // Fallback for unknown strings
        displayMessage = alarm.message;
      }
    }
    // 2. Fallback: Generic Message Key Translation (e.g. Breakers)
    else if (
      alarm.messageKey &&
      t(alarm.messageKey, language) !== alarm.messageKey
    ) {
      displayMessage = t(alarm.messageKey, language);
    }

    const isAcknowledged = alarm.acknowledged;

    return (
      <Link
        href={`/plant/${alarm.plantId}?faultId=${alarm.id.replace("fault-", "")}`}
        className="block"
      >
        <div
          className={cn(
            "flex items-start gap-4 p-3 hover:bg-muted/50 rounded-lg transition-colors",
            isAcknowledged && "opacity-60",
          )}
        >
          <div className="mt-1">
            {isAcknowledged ? (
              <ShieldCheck className="h-5 w-5 text-muted-foreground" />
            ) : (
              priorityIcons[alarm.priority]
            )}
          </div>
          <div className="flex-1">
            <div className="flex justify-between items-center">
              <p className="font-semibold text-sm">{alarm.plantName}</p>
              <Badge
                variant={
                  isAcknowledged
                    ? "secondary"
                    : priorityBadgeVariant[alarm.priority]
                }
                className={cn({
                  [priorityBadgeClass.medium]:
                    !isAcknowledged && alarm.priority === "medium",
                })}
              >
                {t(
                  alarm.priority === "high"
                    ? "priorityHigh"
                    : alarm.priority === "medium"
                      ? "priorityMedium"
                      : "priorityLow",
                  language,
                ).split(":")[1] || alarm.priority}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">{displayMessage}</p>
            <p className="text-xs text-muted-foreground/80 mt-1">
              {formattedDate}
              {alarm.faultCounter && ` • #${alarm.faultCounter}`}
            </p>
          </div>
        </div>
      </Link>
    );
  };

  if (loading) {
    return (
      <Card className="h-full flex flex-col">
        <CardHeader>
          <CardTitle className="font-headline flex items-center gap-2">
            <RefreshCw className="h-5 w-5 animate-spin" />
            {t("alarmsTitle", language)}
          </CardTitle>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className="h-full flex flex-col">
      <CardHeader>
        <CardTitle className="font-headline">
          {t("alarmsTitle", language)}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col p-0">
        <Tabs
          defaultValue="active"
          className="flex-1 flex flex-col"
          onValueChange={(value) => setActiveTab(value as AlarmStatus)}
        >
          <TabsList className="grid w-full grid-cols-2 mx-auto px-6">
            <TabsTrigger value="active">
              {t("activeTab", language)} ({activeAlarmsCount})
            </TabsTrigger>
            <TabsTrigger value="acknowledged">
              {t("acknowledgedTab", language)} ({acknowledgedAlarmsCount})
            </TabsTrigger>
          </TabsList>
          <div className="flex-1 overflow-y-auto px-2 py-4">
            <TabsContent value="active" className="m-0">
              {filteredAlarms.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  {t("noActiveAlarmsMessage", language)}
                </p>
              ) : (
                <div className="space-y-2">
                  {filteredAlarms.map((alarm) => (
                    <AlarmItem key={alarm.id} alarm={alarm} />
                  ))}
                </div>
              )}
            </TabsContent>
            <TabsContent value="acknowledged" className="m-0">
              {filteredAlarms.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  {t("noAcknowledgedAlarmsMessage", language)}
                </p>
              ) : (
                <div className="space-y-2">
                  {filteredAlarms.map((alarm) => (
                    <AlarmItem key={alarm.id} alarm={alarm} />
                  ))}
                </div>
              )}
            </TabsContent>
          </div>
        </Tabs>
      </CardContent>
    </Card>
  );
}
