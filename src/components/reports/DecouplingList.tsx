import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/contexts/language-context";
import { t } from "@/lib/i18n";

interface DecouplingListProps {
  data: {
    plant_name: string;
    relay_id: number;
    fault_count: number;
  }[];
}

export function DecouplingList({ data }: DecouplingListProps) {
  const { language } = useLanguage();
  return (
    <Card className="col-span-1">
      <CardHeader>
        <CardTitle>{t("criticalPlants", language)}</CardTitle>
        <CardDescription>{t("criticalPlantsDesc", language)}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {data.map((item, i) => (
            <div
              key={`${item.plant_name}-${item.relay_id}`}
              className="flex items-center justify-between border-b pb-2 last:border-0 last:pb-0"
            >
              <div>
                <p className="font-medium text-sm">{item.plant_name}</p>
                <p className="text-xs text-muted-foreground mr-2">
                  Relais {item.relay_id}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={i === 0 ? "destructive" : "secondary"}>
                  {item.fault_count} Incidents
                </Badge>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
