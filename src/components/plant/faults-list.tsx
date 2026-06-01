import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, Check, Trash2, RefreshCw } from "lucide-react";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { t } from "@/lib/i18n";
import { useLanguage } from "@/contexts/language-context";

interface Fault {
  id: number;
  relay_id: number;
  fault_index: number;
  fault_counter: number;
  timestamp: string;
  date: string;
  time: string;
  cause: string;
  fault_description: string;
  current_l1: number;
  current_l2: number;
  current_l3: number;
  voltage_u12: number;
  voltage_u23: number;
  voltage_u31: number;
  fault_type: string;
  is_active: boolean;
  acknowledged: boolean;
  acknowledged_by: number | null;
  acknowledged_at: string | null;
  acknowledged_by_username?: string;
  created_at: string;
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

interface FaultsListProps {
  relayId: number;
  isAdmin: boolean;
}

export function FaultsList({ relayId, isAdmin }: FaultsListProps) {
  const { toast } = useToast();
  const { language } = useLanguage();
  const [faults, setFaults] = useState<Fault[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchFaults = async () => {
    try {
      const token = localStorage.getItem("authToken");
      const response = await fetch(`/api/relays/${relayId}/faults`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setFaults(data);
      }
    } catch (error) {
      console.error("Error fetching faults:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFaults();
    // Refresh every 60 seconds
    const interval = setInterval(fetchFaults, 60000);
    return () => clearInterval(interval);
  }, [relayId]);

  // Auto-scroll to fault if faultId is in URL
  useEffect(() => {
    console.log("[FaultsList] Auto-scroll effect triggered");
    console.log("[FaultsList] Current URL:", window.location.href);
    console.log("[FaultsList] Search params:", window.location.search);

    const params = new URLSearchParams(window.location.search);
    const faultId = params.get("faultId");

    console.log("[FaultsList] Fault ID from URL:", faultId);
    console.log("[FaultsList] Faults count:", faults.length);

    if (faultId && faults.length > 0) {
      console.log("[FaultsList] Attempting to scroll to fault-" + faultId);
      setTimeout(() => {
        const element = document.getElementById(`fault-${faultId}`);
        console.log("[FaultsList] Element found:", element);
        if (element) {
          console.log("[FaultsList] Scrolling to element");
          element.scrollIntoView({ behavior: "smooth", block: "center" });
          element.classList.add("ring-2", "ring-primary", "ring-offset-2");
          setTimeout(() => {
            element.classList.remove("ring-2", "ring-primary", "ring-offset-2");
          }, 2000);
        } else {
          console.log(
            "[FaultsList] Element NOT found with id: fault-" + faultId,
          );
          console.log(
            "[FaultsList] Available fault IDs:",
            faults.map((f) => f.id),
          );
        }
      }, 500);
    } else {
      console.log(
        "[FaultsList] Conditions not met - faultId:",
        faultId,
        "faults.length:",
        faults.length,
      );
    }
  }, [faults]);

  const handleAcknowledge = async (faultId: number) => {
    try {
      const token = localStorage.getItem("authToken");
      const response = await fetch(
        `/api/relays/${relayId}/faults/${faultId}/acknowledge`,
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
      toast({
        title: t("error", language),
        description: "Erreur lors de l'acquittement",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (faultId: number) => {
    if (!confirm("Êtes-vous sûr de vouloir supprimer cet incident ?")) return;

    try {
      const token = localStorage.getItem("authToken");
      const response = await fetch(`/api/relays/${relayId}/faults/${faultId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        toast({
          title: t("success", language),
          description: "Incident supprimé",
          variant: "default",
        });
        fetchFaults();
      }
    } catch (error) {
      console.error("Error deleting fault:", error);
      toast({
        title: t("error", language),
        description: "Erreur lors de la suppression",
        variant: "destructive",
      });
    }
  };

  const handleDeleteAll = async () => {
    if (!confirm("Êtes-vous sûr de vouloir supprimer TOUS les incidents ?"))
      return;

    try {
      const token = localStorage.getItem("authToken");
      const response = await fetch(`/api/relays/${relayId}/faults`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        toast({
          title: t("success", language),
          description: "Tous les incidents ont été supprimés",
          variant: "default",
        });
        fetchFaults();
      }
    } catch (error) {
      console.error("Error deleting all faults:", error);
      toast({
        title: t("error", language),
        description: "Erreur lors de la suppression",
        variant: "destructive",
      });
    }
  };

  const activeFaults = faults.filter((f) => f.is_active && !f.acknowledged);
  const historyFaults = faults
    .filter((f) => f.acknowledged || !f.is_active)
    .slice(0, 10);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5 animate-spin" />
            Chargement des incidents...
          </CardTitle>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Active Faults */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-red-500" />
            Incidents Actifs ({activeFaults.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {activeFaults.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Aucun incident actif
            </p>
          ) : (
            <div className="space-y-3">
              {activeFaults.map((fault) => (
                <div
                  key={fault.id}
                  id={`fault-${fault.id}`}
                  className="border rounded-lg p-4 space-y-2 scroll-mt-4"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="destructive">Actif</Badge>
                        <span className="text-sm font-medium">
                          {fault.fault_type}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {formatFaultTimestamp(fault)} • Compteur:{" "}
                        {fault.fault_counter}
                      </p>
                      {fault.cause && (
                        <p className="text-sm mt-1">Cause: {fault.cause}</p>
                      )}
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleAcknowledge(fault.id)}
                    >
                      <Check className="h-4 w-4 mr-1" />
                      Acquitter
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-muted-foreground">Courants: </span>
                      L1={fault.current_l1?.toFixed(1)}A, L2=
                      {fault.current_l2?.toFixed(1)}A, L3=
                      {fault.current_l3?.toFixed(1)}A
                    </div>
                    <div>
                      <span className="text-muted-foreground">Tensions: </span>
                      U12={fault.voltage_u12?.toFixed(1)}V, U23=
                      {fault.voltage_u23?.toFixed(1)}V, U31=
                      {fault.voltage_u31?.toFixed(1)}V
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* History */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle className="flex items-center gap-2">
            <Check className="h-5 w-5 text-green-500" />
            Historique (10 derniers)
          </CardTitle>
          {isAdmin && historyFaults.length > 0 && (
            <Button size="sm" variant="destructive" onClick={handleDeleteAll}>
              <Trash2 className="h-4 w-4 mr-1" />
              Effacer tout
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {historyFaults.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucun historique</p>
          ) : (
            <div className="space-y-2">
              {historyFaults.map((fault) => (
                <div key={fault.id} className="border rounded-lg p-3 space-y-1">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">
                          {fault.acknowledged ? "Acquitté" : "Résolu"}
                        </Badge>
                        <span className="text-sm">{fault.fault_type}</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatFaultTimestamp(fault)}
                      </p>
                      {fault.acknowledged && fault.acknowledged_by_username && (
                        <p className="text-xs text-muted-foreground">
                          Acquitté par: {fault.acknowledged_by_username}
                        </p>
                      )}
                    </div>
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
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
