import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, AlertCircle } from "lucide-react";
import type { TestResult } from "@/types/measurement";

interface TestResultModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  result: TestResult | null;
  relayInfo?: {
    ipAddress: string;
    port: number;
  };
}

export function TestResultModal({
  open,
  onOpenChange,
  result,
  relayInfo,
}: TestResultModalProps) {
  if (!result) return null;

  const isSuccess = result.success && !result.error;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isSuccess ? (
              <>
                <CheckCircle2 className="h-5 w-5 text-green-500" />
                Résultat du Test
              </>
            ) : (
              <>
                <XCircle className="h-5 w-5 text-red-500" />
                Erreur de Lecture
              </>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {relayInfo && (
            <div className="text-sm text-muted-foreground">
              Relay: {relayInfo.ipAddress}:{relayInfo.port}
            </div>
          )}

          {isSuccess ? (
            <>
              {/* Raw Data */}
              <div className="border rounded-lg p-4 bg-muted/50">
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <Badge variant="outline">Raw Data</Badge>
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">
                      Hexadécimal
                    </div>
                    <div className="font-mono text-lg">{result.rawHex}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">
                      Décimal
                    </div>
                    <div className="font-mono text-lg">
                      {result.rawDec?.toLocaleString()}
                    </div>
                  </div>
                </div>
              </div>

              {/* Calculated Value */}
              <div className="border rounded-lg p-4 bg-primary/5">
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <Badge>Valeur Calculée</Badge>
                </h3>
                <div className="text-3xl font-bold text-primary">
                  {result.calculatedValue?.toFixed(2)} {result.unit}
                </div>
              </div>

              {/* Formula */}
              <div className="border rounded-lg p-4">
                <h3 className="font-semibold mb-2 text-sm text-muted-foreground">
                  Formule
                </h3>
                <div className="font-mono text-sm whitespace-pre-line bg-muted/30 p-3 rounded">
                  {result.formula}
                </div>
              </div>

              {/* Calculation Details */}
              {result.calculationDetails && (
                <div className="border rounded-lg p-4">
                  <h3 className="font-semibold mb-2 text-sm text-muted-foreground">
                    Détails du Calcul
                  </h3>
                  <div className="font-mono text-sm bg-muted/30 p-3 rounded">
                    {result.calculationDetails}
                  </div>
                </div>
              )}

              {/* References Used */}
              {result.references && (
                <div className="border rounded-lg p-4">
                  <h3 className="font-semibold mb-2 text-sm text-muted-foreground">
                    Valeurs de Référence
                  </h3>
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    {result.references.inp && (
                      <div>
                        <span className="text-muted-foreground">Inp:</span>{" "}
                        <span className="font-semibold">
                          {result.references.inp} A
                        </span>
                      </div>
                    )}
                    {result.references.unp && (
                      <div>
                        <span className="text-muted-foreground">Unp:</span>{" "}
                        <span className="font-semibold">
                          {result.references.unp} V
                        </span>
                      </div>
                    )}
                    {result.references.un && (
                      <div>
                        <span className="text-muted-foreground">Un:</span>{" "}
                        <span className="font-semibold">
                          {result.references.un} V
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          ) : (
            <>
              {/* Error Display */}
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <div className="font-semibold mb-2">{result.error}</div>
                  {relayInfo && (
                    <div className="text-sm">
                      IP: {relayInfo.ipAddress}:{relayInfo.port}
                    </div>
                  )}
                </AlertDescription>
              </Alert>

              {/* Suggestions */}
              {result.suggestion && (
                <div className="border rounded-lg p-4 bg-muted/50">
                  <h3 className="font-semibold mb-2 text-sm">Suggestions</h3>
                  <ul className="list-disc list-inside text-sm space-y-1 text-muted-foreground">
                    {result.suggestion
                      .split("•")
                      .filter((s) => s.trim())
                      .map((suggestion, i) => (
                        <li key={i}>{suggestion.trim()}</li>
                      ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
