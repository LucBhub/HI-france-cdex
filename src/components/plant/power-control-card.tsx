"use client";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { type Plant } from "@/lib/data";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";
import { controlAllRelays } from "@/lib/api";
import { RefreshCw, RotateCcw } from "lucide-react";

interface PowerControlCardProps {
  plant: Plant;
}

import { t } from "@/lib/i18n";
import { useLanguage } from "@/contexts/language-context";

// ... imports

export function PowerControlCard({ plant }: PowerControlCardProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const { language } = useLanguage();
  const [logs, setLogs] = useState<string[]>([]);

  useEffect(() => {
    // Only set initial message if logs are empty (on mount)
    if (logs.length === 0) {
      setLogs([t("waitingForCommand", language)]);
    }
    // Update the "Waiting..." message if language changes and it's the only log
    else if (
      logs.length === 1 &&
      (logs[0].startsWith("En attente") ||
        logs[0].startsWith("Waiting") ||
        logs[0].startsWith("In attesa"))
    ) {
      setLogs([t("waitingForCommand", language)]);
    }
  }, [language]);

  const currentPowerKw = plant.powerOutput ?? 0;
  const formattedPowerKw = Number(currentPowerKw).toLocaleString("fr-FR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });

  const handlePowerControlAll = async (
    action: "couple" | "decouple" | "reset",
  ) => {
    if (!plant.relays || plant.relays.length === 0) {
      toast({
        variant: "destructive",
        title: t("error", language),
        description: t("noRelaysConfigured", language),
      });
      return;
    }

    setIsLoading(true);
    const timestamp = new Date().toLocaleTimeString("fr-FR");
    // Translate action name
    const actionName = t(`command_${action}`, language);
    setLogs((prev) => [
      `[${timestamp}] ${t("log_attempting", language)} '${actionName}' ${plant.relays?.length || 0} ${t("log_relays", language)}...`,
      ...prev,
    ]);

    try {
      const result = await controlAllRelays(plant.id, action);

      // Add detailed logs for each relay
      if (result.results) {
        result.results.forEach((relayResult: any) => {
          const ts = new Date().toLocaleTimeString("fr-FR");
          const status = relayResult.success ? "✓" : "✗";

          // Translate message if key available
          let message = relayResult.message;
          if (relayResult.messageKey) {
            message = t(relayResult.messageKey, language);
          }

          setLogs((prev) => [
            `[${ts}] ${status} Relay ${relayResult.ipAddress}:${relayResult.port || 502} - ${message}`,
            ...prev,
          ]);
        });
      }

      // Add summary
      const summaryTs = new Date().toLocaleTimeString("fr-FR");

      // Translate summary message if key available (not standard yet in backend summary, but good practice)
      // For now we rely on success/partial/error structure
      let summaryMessage = result.message;
      // Ideally backend would also send messageKey for summary, but we didn't add that yet.
      // We can infer simplified summary or just leave as is for now since user asked for logs mostly.

      if (result.success) {
        setLogs((prev) => [
          `[${summaryTs}] ✓ ${t("log_success", language)}`,
          ...prev,
        ]);
        toast({
          title: t("success", language),
          description: result.message,
        });
      } else {
        setLogs((prev) => [
          `[${summaryTs}] ⚠ ${t("log_partial_success", language)}`,
          ...prev,
        ]);
        toast({
          variant: "destructive",
          title: t("partialSuccess", language) || "Partial Success",
          description: result.message,
        });
      }
    } catch (error: any) {
      const errorTs = new Date().toLocaleTimeString("fr-FR");
      setLogs((prev) => [
        `[${errorTs}] ${t("log_error", language)}: ${error.message}`,
        ...prev,
      ]);
      toast({
        variant: "destructive",
        title: t("error", language),
        description: error.message || `Failed to ${action} the relays.`,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-center text-lg font-medium">
            {t("currentPower", language)}
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center">
          <p className="text-3xl font-bold">
            {formattedPowerKw} <span className="text-xl font-normal">kW</span>
          </p>
          <p className="text-sm text-muted-foreground">
            {t("capacity", language)}: {plant.powerKwc} kWc
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base">
            {t("controlManeuvers", language)}
          </CardTitle>
          <CardDescription className="text-xs">
            {t("controlAllRelaysDescription", language) ||
              `Contrôler tous les ${plant.relays?.length || 0} relais simultanément`}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Button
              onClick={() => handlePowerControlAll("couple")}
              disabled={isLoading || !plant.relays || plant.relays.length === 0}
              className="border-green-200 hover:bg-green-50 text-green-700"
              variant="outline"
            >
              {isLoading ? (
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              {t("coupleAll", language)}
            </Button>
            <Button
              variant="destructive"
              onClick={() => handlePowerControlAll("decouple")}
              disabled={isLoading || !plant.relays || plant.relays.length === 0}
            >
              {isLoading ? (
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              {t("decoupleAll", language)}
            </Button>
            <Button
              variant="outline"
              onClick={() => handlePowerControlAll("reset")}
              disabled={isLoading || !plant.relays || plant.relays.length === 0}
              className="col-span-2 border-blue-200 hover:bg-blue-50 text-blue-700"
            >
              {isLoading ? (
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RotateCcw className="mr-2 h-4 w-4" />
              )}
              {t("resetAll", language)}
            </Button>
          </div>
          {plant.relays && plant.relays.length > 0 && (
            <p className="text-xs text-muted-foreground text-center">
              {plant.relays.length}{" "}
              {plant.relays.length === 1
                ? t("relayConfigured", language)
                : t("relaysConfigured", language)}
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="p-4">
          <CardTitle className="text-base font-medium">
            {t("commandLogs", language)}
          </CardTitle>
          <CardDescription className="text-xs">
            {t("realTimeFeedback", language)}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          <Textarea
            readOnly
            value={logs.join("\n")}
            className="h-40 text-xs font-mono bg-muted/50 resize-none"
            placeholder={t("logsPlaceholder", language)}
          />
        </CardContent>
      </Card>
    </div>
  );
}
