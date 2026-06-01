"use client";
import { usePathname } from "next/navigation";
import { ThemeToggleButton } from "@/components/theme-toggle-button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { type Plant } from "@/lib/data";
import { useAuth } from "@/contexts/auth-context";
import { SearchCommand } from "./search-command";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { t } from "@/lib/i18n";
import { useLanguage } from "@/contexts/language-context";

export function Header({ solarPlants }: { solarPlants: Plant[] }) {
  const pathname = usePathname();
  const { loading } = useAuth();
  const { language } = useLanguage();

  const getTitle = () => {
    if (pathname.startsWith("/plant/")) {
      const id = parseInt(pathname.split("/")[2]);
      const plant = solarPlants.find((p) => p.id === id);
      return plant
        ? `${t("synoptic", language)}: ${plant.name}`
        : t("synoptic", language);
    }
    switch (pathname) {
      case "/":
        return t("dashboard", language);
      case "/settings":
        return t("settings", language);
      case "/reports":
        return t("reportsAnalysis", language);
      case "/admin":
        return t("adminPanel", language);
      case "/synoptic":
        return t("synoptic", language);
      default:
        return t("hypervisor", language);
    }
  };

  // Do not render header on login page or while auth is loading
  if (pathname === "/login" || loading) {
    return null;
  }

  return (
    <header className="sticky top-0 z-40 flex h-16 items-center gap-4 border-b bg-background/80 backdrop-blur-sm px-4 md:px-6">
      <div className="md:hidden">
        <SidebarTrigger />
      </div>
      <h1 className="flex-1 text-2xl font-bold tracking-tight font-headline">
        {getTitle()}
      </h1>
      <div className="flex items-center gap-4">
        <SearchCommand solarPlants={solarPlants} />
        <LanguageSwitcher />
        <ThemeToggleButton />
      </div>
    </header>
  );
}
