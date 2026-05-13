import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  DEFAULT_LANG,
  FALLBACK_LANG,
  LANGUAGES,
  detectBrowserLanguage,
  getLanguage,
  type LanguageCode,
  type LanguageMeta,
} from "./languages";

import en, { type StringKey } from "./locales/en";
import am from "./locales/am";
import he from "./locales/he";
import ru from "./locales/ru";
import fr from "./locales/fr";
import kuki from "./locales/kuki";

type Dict = Partial<Record<StringKey, string>>;

// Registry of loaded dictionaries. To add a language: drop a file in
// /lib/locales and register it here AND in /lib/languages.ts.
const dictionaries: Record<LanguageCode, Dict> = {
  en,
  am,
  he,
  ru,
  fr,
  kuki,
};

type Ctx = {
  lang: LanguageCode;
  meta: LanguageMeta;
  setLang: (l: LanguageCode) => void;
  /** Translate a key, falling back through requested → English → key itself. */
  t: (key: StringKey) => string;
  dir: "ltr" | "rtl";
  languages: LanguageMeta[];
  /** When true, the language is enforced (e.g. owner must use Hebrew) and the switcher should be hidden. */
  locked: boolean;
  /** Force a language and lock it. Pass null to unlock. */
  lockLanguage: (l: LanguageCode | null) => void;
};

const I18nContext = createContext<Ctx | null>(null);
const STORAGE_KEY = "hda.lang";

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<LanguageCode>(DEFAULT_LANG);
  const [locked, setLocked] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = localStorage.getItem(STORAGE_KEY) as LanguageCode | null;
    if (saved && getLanguage(saved)?.enabled) {
      setLangState(saved);
    } else {
      setLangState(detectBrowserLanguage());
    }
  }, []);

  const meta = useMemo(() => getLanguage(lang) ?? getLanguage(DEFAULT_LANG)!, [lang]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.lang = meta.code;
    document.documentElement.dir = meta.dir;
  }, [meta]);

  const setLang = (l: LanguageCode) => {
    if (locked) return;
    if (!getLanguage(l)?.enabled) return;
    setLangState(l);
    if (typeof window !== "undefined") localStorage.setItem(STORAGE_KEY, l);
  };

  const lockLanguage = (l: LanguageCode | null) => {
    if (l === null) {
      setLocked(false);
      return;
    }
    if (!getLanguage(l)?.enabled) return;
    setLangState(l);
    setLocked(true);
  };

  const t = (key: StringKey): string => {
    return (
      dictionaries[lang]?.[key] ??
      dictionaries[FALLBACK_LANG]?.[key] ??
      dictionaries.en[key] ??
      String(key)
    );
  };

  return (
    <I18nContext.Provider value={{ lang, meta, setLang, t, dir: meta.dir, languages: LANGUAGES.filter((l) => l.enabled), locked, lockLanguage }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used inside I18nProvider");
  return ctx;
}

// Re-exports for convenience
export type { LanguageCode, LanguageMeta, StringKey };
export { localized } from "./languages";
