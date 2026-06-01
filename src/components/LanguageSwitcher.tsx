// src/components/LanguageSwitcher.tsx
"use client";

import React from "react";
import { useLanguage } from "@/contexts/language-context";
import { t } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const LanguageSwitcher: React.FC = () => {
  const { language, setLanguage } = useLanguage();

  const languages = {
    en: { label: "English", flag: "🇬🇧" },
    fr: { label: "Français", flag: "🇫🇷" },
    it: { label: "Italiano", flag: "🇮🇹" },
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon" title={t("language", language)}>
          <span className="text-lg">{languages[language].flag}</span>
          <span className="sr-only">{t("language", language)}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {(Object.keys(languages) as Array<keyof typeof languages>).map(
          (lang) => (
            <DropdownMenuItem key={lang} onClick={() => setLanguage(lang)}>
              <span className="mr-2 text-lg">{languages[lang].flag}</span>
              {languages[lang].label}
            </DropdownMenuItem>
          ),
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default LanguageSwitcher;
