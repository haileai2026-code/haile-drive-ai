// Central language registry. Adding a new language = add one entry here
// + create src/lib/locales/{code}.ts. Nothing else in the app needs to change.

export type LanguageCode = string; // BCP-47-ish; stay generic for future langs

export type LanguageMeta = {
  code: LanguageCode;
  /** English name, used in admin/devtools */
  name: string;
  /** Name as written in the language itself (shown in UI) */
  nativeName: string;
  /** Emoji flag or community symbol */
  flag: string;
  dir: "ltr" | "rtl";
  /** Voice/TTS BCP-47 tag for synthesis (ElevenLabs / Web Speech) */
  voiceLocale: string;
  /** Is this language available to end users? */
  enabled: boolean;
  /** 0..100 — % of UI strings translated. Drives "Beta" badges. */
  coverage: number;
};

export const LANGUAGES: LanguageMeta[] = [
  { code: "am", name: "Amharic", nativeName: "አማርኛ", flag: "🇪🇹", dir: "ltr", voiceLocale: "am-ET", enabled: true, coverage: 100 },
  { code: "he", name: "Hebrew", nativeName: "עברית", flag: "🇮🇱", dir: "rtl", voiceLocale: "he-IL", enabled: true, coverage: 95 },
  { code: "en", name: "English", nativeName: "English", flag: "🇬🇧", dir: "ltr", voiceLocale: "en-US", enabled: true, coverage: 100 },
  { code: "ru", name: "Russian", nativeName: "Русский", flag: "🇷🇺", dir: "ltr", voiceLocale: "ru-RU", enabled: true, coverage: 25 },
  { code: "fr", name: "French", nativeName: "Français", flag: "🇫🇷", dir: "ltr", voiceLocale: "fr-FR", enabled: true, coverage: 25 },
  // "Kuki" / Bnei Menashe — no flag emoji, use community symbol
  { code: "kuki", name: "Kuki (Bnei Menashe)", nativeName: "Kuki", flag: "✡︎", dir: "ltr", voiceLocale: "en-IN", enabled: true, coverage: 15 },
];

export const DEFAULT_LANG: LanguageCode = "am";
export const FALLBACK_LANG: LanguageCode = "en";

export function getLanguage(code: LanguageCode): LanguageMeta | undefined {
  return LANGUAGES.find((l) => l.code === code);
}

export function enabledLanguages(): LanguageMeta[] {
  return LANGUAGES.filter((l) => l.enabled);
}

/**
 * Pick a localized value from a Record<langCode, T>, falling back through:
 * requested → English → first available.
 */
export function localized<T>(
  map: Partial<Record<LanguageCode, T>> | undefined,
  lang: LanguageCode,
): T | undefined {
  if (!map) return undefined;
  return map[lang] ?? map[FALLBACK_LANG] ?? Object.values(map)[0];
}

/** Detect a preferred language from the browser, falling back to default. */
export function detectBrowserLanguage(): LanguageCode {
  if (typeof navigator === "undefined") return DEFAULT_LANG;
  const candidates = (navigator.languages ?? [navigator.language ?? ""]).map((l) => l.toLowerCase());
  for (const c of candidates) {
    const base = c.split("-")[0];
    const hit = LANGUAGES.find((l) => l.enabled && (l.code === c || l.code === base));
    if (hit) return hit.code;
  }
  return DEFAULT_LANG;
}
