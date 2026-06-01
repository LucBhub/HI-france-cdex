import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useLanguage } from "@/contexts/language-context";
import { t } from "@/lib/i18n";
import { Badge } from "@/components/ui/badge";

interface InterventionTableProps {
  data: {
    username: string;
    count: number;
    recouples: number;
    resets: number;
  }[];
}

export function InterventionTable({ data }: InterventionTableProps) {
  const { language } = useLanguage();
  return (
    <Card className="col-span-2">
      <CardHeader>
        <CardTitle>{t("interventionLeaderboard", language)}</CardTitle>
        <CardDescription>
          {t("interventionLeaderboardDesc", language)}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("operator", language)}</TableHead>
              <TableHead className="text-center">
                {t("interventions", language)}
              </TableHead>
              <TableHead className="text-center">Recouplages</TableHead>
              <TableHead className="text-center">Resets</TableHead>
              <TableHead className="text-right">
                {t("efficiency", language)}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((user) => (
              <TableRow key={user.username}>
                <TableCell className="font-medium">{user.username}</TableCell>
                <TableCell className="text-center">
                  <Badge variant="outline">{user.count}</Badge>
                </TableCell>
                <TableCell className="text-center text-green-600">
                  {user.recouples}
                </TableCell>
                <TableCell className="text-center text-blue-600">
                  {user.resets}
                </TableCell>
                <TableCell className="text-right">
                  {/* Dummy efficiency calc or just % of recouples */}
                  {user.count > 0
                    ? ((user.recouples / user.count) * 100).toFixed(0)
                    : 0}
                  % Recoup.
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
