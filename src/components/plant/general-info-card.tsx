"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { type Plant } from "@/lib/data";

interface GeneralInfoCardProps {
  plant: Plant;
}

import { t } from "@/lib/i18n";
import { useLanguage } from "@/contexts/language-context";

// ... imports

export function GeneralInfoCard({ plant }: GeneralInfoCardProps) {
  const { language } = useLanguage();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-center text-lg font-medium">
          {t("generalInfo", language)}
        </CardTitle>
      </CardHeader>
      <CardContent className="text-sm space-y-2">
        <p>
          <span className="font-semibold">{t("ce", language)} :</span>{" "}
          {plant.ce}
        </p>
        <p>
          <span className="font-semibold">{t("address", language)} :</span>{" "}
          {plant.address}
        </p>
        <p>
          <span className="font-semibold">
            {t("gpsCoordinates", language)} :
          </span>{" "}
          {plant.gps}
        </p>
        <p>
          <span className="font-semibold">{t("power", language)} :</span>{" "}
          {plant.powerKwc} kWc
        </p>
      </CardContent>
    </Card>
  );
}
