// src/contexts/language-context.tsx
import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import { useAuth } from "./auth-context";

export type Language = "en" | "fr" | "it";

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
}

const LanguageContext = createContext<LanguageContextType | undefined>(
  undefined,
);

export const LanguageProvider = ({ children }: { children: ReactNode }) => {
  const [language, setLanguage] = useState<Language>("en");
  const { user } = useAuth();

  // 1. Initial load from localStorage
  useEffect(() => {
    const stored = localStorage.getItem("appLanguage") as Language | null;
    if (stored) {
      setLanguage(stored);
    }
  }, []);

  // 2. Synchronize with user profile from backend (e.g. Microsoft Account language)
  useEffect(() => {
    if (user?.language) {
      // Normalize language code (e.g., 'fr-FR' -> 'fr')
      const normalized = user.language.split("-")[0].toLowerCase() as Language;
      const supportedLanguages: Language[] = ["en", "fr", "it"];

      if (supportedLanguages.includes(normalized) && normalized !== language) {
        console.log(`[Language] Syncing with user profile: ${normalized}`);
        setLanguage(normalized);
        localStorage.setItem("appLanguage", normalized);
      }
    }
  }, [user?.language]);

  const changeLanguage = (lang: Language) => {
    setLanguage(lang);
    localStorage.setItem("appLanguage", lang);
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage: changeLanguage }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
};
export default LanguageProvider;
