// src/components/layout/search-command.tsx
"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Network, Search, Sun } from "lucide-react";

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import { type Plant } from "@/lib/data";
import { DialogTitle } from "@radix-ui/react-dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { t } from "@/lib/i18n";
import { useLanguage } from "@/contexts/language-context";

export function SearchCommand({ solarPlants }: { solarPlants: Plant[] }) {
  const [open, setOpen] = React.useState(false);
  const router = useRouter();
  const { language } = useLanguage();

  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const handleSelect = (plantId: number) => {
    router.push(`/plant/${plantId}`);
    setOpen(false);
  };

  return (
    <>
      <Button
        variant="outline"
        className="h-10 w-10 p-0 md:w-auto md:px-4 md:py-2 md:justify-start"
        onClick={() => setOpen(true)}
      >
        <Search className="h-4 w-4 md:mr-2" />
        <span className="hidden md:inline">
          {t("searchPlaceholder", language)}
        </span>
      </Button>
      <CommandDialog open={open} onOpenChange={setOpen}>
        <VisuallyHidden>
          <DialogTitle>{t("searchTitle", language)}</DialogTitle>
        </VisuallyHidden>
        <CommandInput placeholder={t("searchCommandPlaceholder", language)} />
        <CommandList>
          <CommandEmpty>{t("noResults", language)}</CommandEmpty>
          <CommandGroup heading={t("solarPlants", language)}>
            {solarPlants.map((plant) => (
              <CommandItem
                key={plant.id}
                onSelect={() => {
                  console.log("Selected plant:", plant.id);
                  handleSelect(plant.id);
                }}
                value={`${plant.name}-${plant.id}`} // Ensure unique value
                keywords={[
                  plant.name,
                  plant.siteCode || "",
                  plant.source === "france_ignition" ? "france ignition" : "legacy modbus",
                ]} // Allow searching by name accurately
              >
                {plant.source === "france_ignition" ? (
                  <Network className="mr-2 h-4 w-4" />
                ) : (
                  <Sun className="mr-2 h-4 w-4" />
                )}
                <span className="min-w-0 flex-1 truncate">{plant.name}</span>
                {plant.source === "france_ignition" && (
                  <span className="ml-2 rounded border px-1.5 py-0.5 text-[10px] uppercase text-muted-foreground">
                    France
                  </span>
                )}
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  );
}
