"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import nl from "./nl.json";
import en from "./en.json";
import de from "./de.json";
import fr from "./fr.json";
import es from "./es.json";
import pt from "./pt.json";
import it from "./it.json";

export type Locale = "nl" | "en" | "de" | "fr" | "es" | "pt" | "it";

const translations: Record<string, any> = { nl, en, de, fr, es, pt, it };

// Fallback: als sleutel niet bestaat in gekozen taal → gebruik nl
function getNestedValue(obj: any, path: string): string | undefined {
  return path.split(".").reduce((acc, key) => acc?.[key], obj);
}

function translate(locale: Locale, key: string, params?: Record<string, string | number>): string {
  const dict = translations[locale] || translations["nl"];
  const fallback = translations["nl"];
  let value = getNestedValue(dict, key) ?? getNestedValue(fallback, key) ?? key;
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      value = value.replace(`{${k}}`, String(v));
    });
  }
  return value;
}

// Context
interface I18nContextType {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nContextType>({
  locale: "nl",
  setLocale: () => {},
  t: (key) => key,
});

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("nl");

  useEffect(() => {
    // Lees voorkeur uit localStorage of browser
    const stored = typeof window !== "undefined" ? localStorage.getItem("wp_locale") as Locale : null;
    if (stored && translations[stored]) {
      setLocaleState(stored);
    } else {
      // Detecteer browser taal
      const browser = navigator.language?.split("-")[0] as Locale;
      if (translations[browser]) setLocaleState(browser);
    }
  }, []);

  function setLocale(l: Locale) {
    setLocaleState(l);
    localStorage.setItem("wp_locale", l);
  }

  const t = (key: string, params?: Record<string, string | number>) =>
    translate(locale, key, params);

  return (
    <I18nContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  return useContext(I18nContext);
}

// Standalone t() voor buiten React (server components, utils)
export function getT(locale: Locale = "nl") {
  return (key: string, params?: Record<string, string | number>) =>
    translate(locale, key, params);
}

export const SUPPORTED_LOCALES: { code: Locale; label: string; flag: string }[] = [
  { code: "nl", label: "Nederlands", flag: "🇳🇱" },
  { code: "en", label: "English",    flag: "🇬🇧" },
  { code: "de", label: "Deutsch",    flag: "🇩🇪" },
  { code: "fr", label: "Français",   flag: "🇫🇷" },
  { code: "es", label: "Español",    flag: "🇪🇸" },
  { code: "pt", label: "Português",  flag: "🇵🇹" },
  { code: "it", label: "Italiano",    flag: "🇮🇹" },
];
