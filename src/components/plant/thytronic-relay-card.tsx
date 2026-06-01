import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Activity,
  Zap,
  Power,
  Lock,
  Unlock,
  RefreshCw,
  AlertCircle,
  RotateCcw,
  Check,
  Trash2,
  ChevronRight,
} from "lucide-react";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { controlRelay, refreshRelayFaults } from "@/lib/api";

interface Relay {
  id: number;
  ipAddress: string;
  port?: number;
  unitId?: number;
  voltageL1?: number;
  voltageL2?: number;
  voltageL3?: number;
  currentL1?: number;
  currentL2?: number;
  currentL3?: number;
  activePower?: number;
  reactivePower?: number;
  apparentPower?: number;
  frequency?: number;
  breakerStatus?: boolean;
  lastUpdated?: string;
  status?: string;
}

interface Fault {
  id: number;
  relay_id: number;
  fault_counter: number;
  timestamp: string;
  created_at: string;
  fault_type: string;
  current_l1: number;
  current_l2: number;
  current_l3: number;
  voltage_u12: number;
  voltage_u23: number;
  voltage_u31: number;
  is_active: boolean;
  acknowledged: boolean;
  acknowledged_by_username?: string;
}

// Helper function to format timestamp
function formatFaultTimestamp(fault: Fault): string {
  try {
    // Use created_at from database instead of corrupted Modbus timestamp
    const date = new Date(fault.created_at);
    return date.toLocaleString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch (e) {
    return fault.timestamp; // Fallback to original if parsing fails
  }
}

interface ThytronicRelayCardProps {
  relay: Relay;
  plantId: number;
}

import { t } from "@/lib/i18n";
import { useLanguage } from "@/contexts/language-context";

export function ThytronicRelayCard({
  relay,
  plantId,
}: ThytronicRelayCardProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const { language } = useLanguage();
  const [faults, setFaults] = useState<Fault[]>([]);
  const [userRole, setUserRole] = useState<string>("member");
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const faultId = params.get("faultId");

    if (faultId && faults.length > 0) {
      // Check if this relay has the fault
      const hasFault = faults.some((f) => f.id === parseInt(faultId));

      if (hasFault) {
        // Open the dialog
        setDialogOpen(true);

        // Scroll to the fault
        setTimeout(() => {
          const element = document.getElementById(`fault-${faultId}`);
          if (element) {
            element.scrollIntoView({ behavior: "smooth", block: "center" });
            element.classList.add("ring-2", "ring-primary", "ring-offset-2");
            setTimeout(() => {
              element.classList.remove(
                "ring-2",
                "ring-primary",
                "ring-offset-2",
              );
            }, 2000);
          }
        }, 500); // Wait for dialog to open
      }
    }
  }, [faults]);

  useEffect(() => {
    const token = localStorage.getItem("authToken");
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split(".")[1]));
        setUserRole(payload.role || "member");
      } catch (e) {
        console.error("Error parsing token:", e);
      }
    }
  }, []);

  const fetchFaults = async () => {
    try {
      const token = localStorage.getItem("authToken");
      const response = await fetch(`/api/relays/${relay.id}/faults`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setFaults(data.slice(0, 5)); // Max 5 for compact display
      }
    } catch (error) {
      console.error("Error fetching faults:", error);
    }
  };

  useEffect(() => {
    fetchFaults();
    const interval = setInterval(fetchFaults, 60000);
    return () => clearInterval(interval);
  }, [relay.id]);

  const handleRefreshFaults = async () => {
    setLoading(true);
    try {
      await refreshRelayFaults(relay.id);
      toast({
        title: t("success", language),
        description: "Lecture des défauts lancée",
      });
      // Wait a bit for the background job to finish reading before fetching again
      setTimeout(fetchFaults, 2000);
    } catch (error) {
      toast({
        title: t("error", language),
        description: "Erreur lors du rafraîchissement",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleControl = async (command: "couple" | "decouple" | "reset") => {
    setLoading(true);
    try {
      toast({
        title: t("loading", language),
        description:
          t("commandSentWait", language) ||
          "Commande envoyée, vérification en cours...",
      });

      const data = await controlRelay(plantId, relay.id, command);
      if (data.success) {
        toast({
          title: t("success", language),
          description: data.messageKey
            ? t(data.messageKey, language)
            : t("commandSuccess", language),
          variant: "success",
        });
      } else {
        toast({
          title: t("commandFailed", language),
          description: data.messageKey
            ? t(data.messageKey, language)
            : data.message || t("commandError", language),
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Control error:", error);
      toast({
        title: t("error", language),
        description: t("commandError", language),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAcknowledge = async (faultId: number) => {
    try {
      const token = localStorage.getItem("authToken");
      const response = await fetch(
        `/api/relays/${relay.id}/faults/${faultId}/acknowledge`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        },
      );
      if (response.ok) {
        toast({
          title: t("success", language),
          description: "Incident acquitté",
          variant: "default",
        });
        fetchFaults();
      }
    } catch (error) {
      console.error("Error acknowledging fault:", error);
    }
  };

  const handleDelete = async (faultId: number) => {
    if (!confirm("Supprimer cet incident ?")) return;
    try {
      const token = localStorage.getItem("authToken");
      const response = await fetch(
        `/api/relays/${relay.id}/faults/${faultId}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      if (response.ok) {
        toast({
          title: t("success", language),
          description: "Incident supprimé",
        });
        fetchFaults();
      }
    } catch (error) {
      console.error("Error deleting fault:", error);
    }
  };

  const formatValue = (val?: number, unit: string = "") => {
    if (val === undefined || val === null) return "-";
    return `${val.toFixed(2)} ${unit}`;
  };

  const isOnline = relay.status === "online";
  const isAdmin = userRole === "admin" || userRole === "superadmin";
  const activeFaults = faults.filter((f) => f.is_active && !f.acknowledged);

  // Helper to translate fault types
  const translateFault = (faultType: string) => {
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
    const key = faultMap[faultType];
    return key ? t(key, language) : faultType;
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          {t("relay", language)} {relay.ipAddress}
          {relay.port ? `:${relay.port}` : ""}
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={handleRefreshFaults}
            disabled={loading}
            title="Rafraîchir les incidents"
          >
            <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </CardTitle>
        <div className="flex items-center gap-2">
          <Badge
            variant={activeFaults.length > 0 ? "destructive" : "outline"}
            className="gap-1 cursor-pointer hover:opacity-80"
            onClick={() => setDialogOpen(true)}
          >
            <AlertCircle className="h-3 w-3" />
            {activeFaults.length}
          </Badge>
          {isOnline ? (
            <Badge
              variant="secondary"
              className="bg-green-100 text-green-800 hover:bg-green-100"
            >
              {t("online", language)}
            </Badge>
          ) : (
            <Badge
              variant="secondary"
              className="bg-red-100 text-red-800 hover:bg-red-100"
            >
              {t("offline", language)}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">
              {t("voltage", language)} (V)
            </p>
            <div className="text-sm font-mono">
              L1: {formatValue(relay.voltageL1, "V")}
            </div>
            <div className="text-sm font-mono">
              L2: {formatValue(relay.voltageL2, "V")}
            </div>
            <div className="text-sm font-mono">
              L3: {formatValue(relay.voltageL3, "V")}
            </div>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">
              {t("current", language)} (A)
            </p>
            <div className="text-sm font-mono">
              L1: {formatValue(relay.currentL1, "A")}
            </div>
            <div className="text-sm font-mono">
              L2: {formatValue(relay.currentL2, "A")}
            </div>
            <div className="text-sm font-mono">
              L3: {formatValue(relay.currentL3, "A")}
            </div>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">
              {t("power", language)}
            </p>
            <div className="text-sm font-mono">
              P: {formatValue(relay.activePower, "kW")}
            </div>
            <div className="text-sm font-mono">
              Q: {formatValue(relay.reactivePower, "kVAR")}
            </div>
            <div className="text-sm font-mono">
              S: {formatValue(relay.apparentPower, "kVA")}
            </div>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">
              {t("frequency", language)}
            </p>
            <div className="text-sm font-mono">
              {formatValue(relay.frequency, "Hz")}
            </div>
          </div>
        </div>

        {/* Dialog for fault details - always available */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                Incidents - Relay {relay.ipAddress}:{relay.port}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              {faults.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <AlertCircle className="h-12 w-12 mx-auto mb-3 opacity-20" />
                  <p className="text-sm">Aucun incident enregistré</p>
                </div>
              ) : (
                faults.map((fault) => (
                  <div
                    key={fault.id}
                    id={`fault-${fault.id}`}
                    className="border rounded-lg p-3 space-y-2 scroll-mt-4"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          {fault.is_active && !fault.acknowledged ? (
                            <Badge variant="destructive">Actif</Badge>
                          ) : (
                            <Badge variant="secondary">
                              {fault.acknowledged ? "Acquitté" : "Résolu"}
                            </Badge>
                          )}
                          <span className="text-sm font-medium">
                            {translateFault(fault.fault_type)}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {formatFaultTimestamp(fault)} • #{fault.fault_counter}
                        </p>
                        {fault.acknowledged_by_username && (
                          <p className="text-xs text-muted-foreground">
                            Par: {fault.acknowledged_by_username}
                          </p>
                        )}
                      </div>
                      <div className="flex gap-1">
                        {fault.is_active && !fault.acknowledged && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleAcknowledge(fault.id)}
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                        )}
                        {isAdmin && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDelete(fault.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs bg-muted/50 p-2 rounded">
                      <div>
                        <span className="font-medium">Courants:</span> L1=
                        {fault.current_l1?.toFixed(1)}A, L2=
                        {fault.current_l2?.toFixed(1)}A, L3=
                        {fault.current_l3?.toFixed(1)}A
                      </div>
                      <div>
                        <span className="font-medium">Tensions:</span> U12=
                        {fault.voltage_u12?.toFixed(1)}V, U23=
                        {fault.voltage_u23?.toFixed(1)}V, U31=
                        {fault.voltage_u31?.toFixed(1)}V
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </DialogContent>
        </Dialog>

        {/* Compact Faults Display */}
        {faults.length > 0 && (
          <div className="border-t pt-3 mb-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-muted-foreground">
                Incidents récents
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-xs"
                onClick={() => setDialogOpen(true)}
              >
                Voir tout <ChevronRight className="h-3 w-3 ml-1" />
              </Button>
            </div>
            <div className="space-y-1">
              {faults.slice(0, 3).map((fault) => (
                <div
                  key={fault.id}
                  className="flex items-center gap-2 text-xs p-1.5 rounded hover:bg-muted/50"
                >
                  {fault.is_active && !fault.acknowledged ? (
                    <AlertCircle className="h-3 w-3 text-red-500 flex-shrink-0" />
                  ) : (
                    <Check className="h-3 w-3 text-green-500 flex-shrink-0" />
                  )}
                  <span className="flex-1 truncate">
                    {translateFault(fault.fault_type)}
                  </span>
                  <span className="text-muted-foreground">
                    {formatFaultTimestamp(fault).split(" ")[0]}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex flex-col gap-3 pt-3 border-t">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">
              {t("breakerStatus", language)}
            </span>
            {relay.breakerStatus ? (
              <Badge className="bg-green-500 hover:bg-green-600">
                {t("closedCoupled", language)}
              </Badge>
            ) : (
              <Badge className="bg-red-500 hover:bg-red-600">
                {t("openDecoupled", language)}
              </Badge>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="outline"
              className="w-full border-green-200 hover:bg-green-50 text-green-700"
              onClick={() => handleControl("couple")}
              disabled={loading}
            >
              {loading ? (
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Lock className="mr-2 h-4 w-4" />
              )}
              {t("couple", language)}
            </Button>
            <Button
              variant="outline"
              className="w-full border-red-200 hover:bg-red-50 text-red-700"
              onClick={() => handleControl("decouple")}
              disabled={loading}
            >
              {loading ? (
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Unlock className="mr-2 h-4 w-4" />
              )}
              {t("decouple", language)}
            </Button>
          </div>
          <Button
            variant="outline"
            className="w-full border-blue-200 hover:bg-blue-50 text-blue-700"
            onClick={() => handleControl("reset")}
            disabled={loading}
          >
            {loading ? (
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RotateCcw className="mr-2 h-4 w-4" />
            )}
            {t("reset", language) || "Reset"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
