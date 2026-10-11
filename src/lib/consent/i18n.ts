// Consent content per language. Hebrew is authoritative. Amharic / Russian
// must NOT ship before native review (6-10 Oct 2026) and approval, so until
// they are added here every language falls back to Hebrew and the record
// stores language = 'he' (the text actually shown). English is internal-only
// and never shown.
import type { LanguageCode } from "@/lib/languages";
import type { ConsentLanguage } from "./versions";
import { HE_CHECKBOX_1, HE_CHECKBOX_2, HE_NOTICE_MD, HE_TERMS_MD } from "./content.he";

export type ConsentContent = {
  language: ConsentLanguage;
  dir: "rtl" | "ltr";
  noticeMd: string;
  termsMd: string;
  checkbox1: string;
  checkbox2: string;
  ui: {
    title: string;
    intro: string;
    required: string;
    optional: string;
    readNotice: string;
    readTerms: string;
    hide: string;
    continue: string;
    saving: string;
    error: string;
    draftBanner: string;
  };
};

const he: ConsentContent = {
  language: "he",
  dir: "rtl",
  noticeMd: HE_NOTICE_MD,
  termsMd: HE_TERMS_MD,
  checkbox1: HE_CHECKBOX_1,
  checkbox2: HE_CHECKBOX_2,
  ui: {
    title: "הודעת פרטיות ותנאי שימוש",
    intro: "לפני שממשיכים, יש לקרוא ולאשר את הודעת הפרטיות ואת תנאי השימוש.",
    required: "חובה",
    optional: "רשות, לא חובה",
    readNotice: "קריאת הודעת הפרטיות",
    readTerms: "קריאת תנאי השימוש",
    hide: "הסתר",
    continue: "המשך",
    saving: "שומר…",
    error: "השמירה נכשלה, נסה/י שוב",
    draftBanner: "טיוטה — הנוסח טרם אושר סופית",
  },
};

// Add "am" / "ru" here only after native review + approval.
const APPROVED: Partial<Record<ConsentLanguage, ConsentContent>> = { he };

export function getConsentContent(lang: LanguageCode): ConsentContent {
  const key = (lang === "am" || lang === "ru" ? lang : "he") as ConsentLanguage;
  return APPROVED[key] ?? he;
}
