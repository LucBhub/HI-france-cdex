"use client";

import { AlertTriangle, Repeat, Hammer, Clock } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/contexts/language-context";
import { t } from "@/lib/i18n";

interface Pattern {
  type: "HAMMERING" | "SHORT_CYCLE" | "RECURRING";
  severity: "critical" | "warning" | "medium";
  message: string;
  timestamp: string;
  relay_id?: number;
}

interface IneffectiveInterventionsProps {
  patterns: Pattern[];
}

export function IneffectiveInterventions({
  patterns,
}: IneffectiveInterventionsProps) {
  const { language } = useLanguage();
  if (!patterns || patterns.length === 0) return null;

  const getIcon = (type: string) => {
    switch (type) {
      case "HAMMERING":
        return <Hammer className="h-4 w-4" />;
      case "SHORT_CYCLE":
        return <Repeat className="h-4 w-4" />;
      case "RECURRING":
        return <Clock className="h-4 w-4" />;
      default:
        return <AlertTriangle className="h-4 w-4" />;
    }
  };

  const getVariant = (severity: string) => {
    switch (severity) {
      case "critical":
        return "destructive";
      case "warning":
        return "warning"; // Custom variant or default
      default:
        return "default";
    }
  };

  const getColor = (severity: string) => {
    switch (severity) {
      case "critical":
        return "bg-red-500/10 text-red-600 dark:text-red-400 border-red-200 dark:border-red-900";
      case "warning":
        return "bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-200 dark:border-orange-900";
      default:
        return "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-900";
    }
  };

  return (
    <Card className="col-span-3 border-orange-200 bg-orange-50/30">
      <CardHeader>
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-orange-600" />
          <CardTitle className="text-orange-700">
            {t("anomalyDetection", language)}
          </CardTitle>
        </div>
        <CardDescription>{t("anomalyDetectionDesc", language)}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {patterns.map((pattern, index) => (
          <div
            key={index}
            className={`flex items-start gap-3 p-3 rounded-lg border ${getColor(pattern.severity)}`}
          >
            <div className="mt-1">{getIcon(pattern.type)}</div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="font-semibold text-sm">
                  {pattern.type === "HAMMERING" && t("hammering", language)}
                  {pattern.type === "SHORT_CYCLE" && t("shortCycle", language)}
                  {pattern.type === "RECURRING" && t("recurring", language)}
                </span>
                {pattern.severity === "critical" && (
                  <Badge variant="destructive" className="h-5 text-[10px]">
                    {t("critical", language)}
                  </Badge>
                )}
              </div>
              <p className="text-sm">{pattern.message}</p>
              <span className="text-xs opacity-70 mt-1 block">
                {new Date(pattern.timestamp).toLocaleString("fr-FR")}
              </span>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
