import { format } from "date-fns";
import { enUS, fr, it } from "date-fns/locale";
import { useLanguage } from "@/contexts/language-context";
import { t } from "@/lib/i18n";

const locales = { en: enUS, fr: fr, it: it };

export type ChartRange = "24h" | "day" | "7d" | "30d";

export function useChartConfig() {
  const { language } = useLanguage();
  const currentLocale = locales[language];

  const formatXAxis = (unixTime: number | string, range: ChartRange) => {
    const date = new Date(unixTime);
    if (range === "24h" || range === "day")
      return format(date, "HH:mm", { locale: currentLocale });
    if (range === "7d")
      return format(date, "dd/MM HH:mm", { locale: currentLocale });
    return format(date, "dd/MM", { locale: currentLocale });
  };

  const formatTooltipLabel = (label: number | string) => {
    return format(new Date(label), "dd MMM yyyy HH:mm", {
      locale: currentLocale,
    });
  };

  const formatTooltipValue = (value: any, name: any) => {
    const val = parseFloat(value);
    switch (name) {
      case "power":
        return [`${val.toFixed(2)} kW`, t("power", language)];
      case "irradiation":
        return [`${val.toFixed(0)} W/m²`, t("irradiation", language)];
      case "voltage":
        return [`${val.toFixed(1)} V`, t("voltage", language)];
      case "current":
        return [`${val.toFixed(1)} A`, t("current", language)];
      case "production":
        return [`${val.toFixed(2)} kW`, t("production", language)];
      default:
        return [value, name];
    }
  };

  const colors = {
    power: { stroke: "#22c55e", fill: "url(#colorPower)" },
    irradiation: { stroke: "#f97316", fill: "#f97316" },
    voltage: { stroke: "#3b82f6" },
    current: { stroke: "#a855f7" },
  };

  return {
    formatXAxis,
    formatTooltipLabel,
    formatTooltipValue,
    colors,
    language,
  };
}
