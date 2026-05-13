import type { LanguageCode } from "./languages";

export type LessonCategory =
  | "traffic-laws"
  | "bus-systems"
  | "air-brakes"
  | "passenger-safety"
  | "road-signs"
  | "pre-trip"
  | "driving-safety"
  | "terminology"
  | "emergency";

/**
 * Localized fields are stored as Record<LanguageCode, string>.
 * Missing languages fall back via `localized()` from /lib/languages.
 * To add a language, add a key to these maps — no schema change needed.
 */
export type Localized<T = string> = Partial<Record<LanguageCode, T>>;

export type Lesson = {
  id: string;
  title: Localized;
  /** Per-language voiceover audio URL (uploaded by admins) */
  voiceTracks?: Localized;
  /** Per-language subtitle URL or VTT */
  subtitles?: Localized;
  category: LessonCategory;
  duration: number;
  progress: number;
  thumbnailHue: number;
};

export const lessons: Lesson[] = [
  {
    id: "air-brakes-1",
    title: { am: "የአየር ብሬክ መሰረታዊ", he: "מערכת בלמי אוויר", en: "Air Brake Basics", ru: "Основы пневмотормозов", fr: "Bases du frein à air" },
    category: "air-brakes",
    duration: 18,
    progress: 100,
    thumbnailHue: 45,
  },
  {
    id: "pre-trip-1",
    title: { am: "የቅድመ ጉዞ ምርመራ", he: "בדיקה לפני נסיעה", en: "Pre-trip Inspection", ru: "Предрейсовый осмотр", fr: "Inspection avant trajet" },
    category: "pre-trip",
    duration: 22,
    progress: 60,
    thumbnailHue: 80,
  },
  {
    id: "signs-1",
    title: { am: "የመንገድ ምልክቶች 1", he: "תמרורי דרך 1", en: "Road Signs I", ru: "Дорожные знаки 1", fr: "Panneaux de route I" },
    category: "road-signs",
    duration: 14,
    progress: 35,
    thumbnailHue: 200,
  },
  {
    id: "passenger-1",
    title: { am: "የመንገደኛ ደህንነት", he: "בטיחות נוסעים", en: "Passenger Safety", ru: "Безопасность пассажиров", fr: "Sécurité des passagers" },
    category: "passenger-safety",
    duration: 20,
    progress: 0,
    thumbnailHue: 12,
  },
  {
    id: "emergency-1",
    title: { am: "አደጋ ጊዜ ሁኔታዎች", he: "מצבי חירום", en: "Emergency Situations", ru: "Аварийные ситуации", fr: "Situations d'urgence" },
    category: "emergency",
    duration: 24,
    progress: 0,
    thumbnailHue: 0,
  },
  {
    id: "terms-1",
    title: { am: "ሙያዊ ቃላት", he: "מונחים מקצועיים", en: "Professional Terms", ru: "Профессиональные термины", fr: "Termes professionnels" },
    category: "terminology",
    duration: 12,
    progress: 0,
    thumbnailHue: 280,
  },
];

export type QuizQuestion = {
  id: string;
  q: Localized;
  options: Localized[]; // each option is itself a Localized map
  correct: number;
  explain: Localized;
};

export const sampleQuestions: QuizQuestion[] = [
  {
    id: "q1",
    q: {
      am: "የአየር ብሬክ ዝቅተኛ ግፊት ማስጠንቀቂያ መቼ ይከሰታል?",
      he: "מתי מופעלת התראת לחץ אוויר נמוך?",
      en: "When does the low air-pressure warning activate?",
      ru: "Когда срабатывает предупреждение о низком давлении воздуха?",
      fr: "Quand l'alerte de basse pression d'air se déclenche-t-elle ?",
    },
    options: [
      { am: "ከ60 PSI በታች ሲሆን", he: "מתחת ל-60 PSI", en: "Below 60 PSI", ru: "Ниже 60 PSI", fr: "Moins de 60 PSI" },
      { am: "ከ100 PSI በላይ", he: "מעל 100 PSI", en: "Above 100 PSI", ru: "Выше 100 PSI", fr: "Au-dessus de 100 PSI" },
      { am: "ሞተር ሲጠፋ ብቻ", he: "רק כשהמנוע כבוי", en: "Only when engine is off", ru: "Только при выключенном двигателе", fr: "Seulement moteur éteint" },
    ],
    correct: 0,
    explain: {
      am: "ግፊቱ ከ60 PSI በታች ሲወርድ ማስጠንቀቂያው ይሰራል።",
      he: "ההתראה פועלת כשהלחץ יורד מתחת ל-60 PSI.",
      en: "The warning triggers when pressure drops below 60 PSI.",
      ru: "Предупреждение срабатывает, когда давление падает ниже 60 PSI.",
      fr: "L'alerte se déclenche quand la pression descend sous 60 PSI.",
    },
  },
  {
    id: "q2",
    q: {
      am: "የቅድመ ጉዞ ምርመራ ምን ያህል ጊዜ ይወስዳል?",
      he: "כמה זמן לוקחת בדיקה לפני נסיעה?",
      en: "How long should a pre-trip inspection take?",
      ru: "Сколько должен длиться предрейсовый осмотр?",
      fr: "Combien de temps doit durer l'inspection avant trajet ?",
    },
    options: [
      { am: "1 ደቂቃ", he: "דקה", en: "1 minute", ru: "1 минута", fr: "1 minute" },
      { am: "10–15 ደቂቃ", he: "10–15 דקות", en: "10–15 minutes", ru: "10–15 минут", fr: "10–15 minutes" },
      { am: "1 ሰዓት", he: "שעה", en: "1 hour", ru: "1 час", fr: "1 heure" },
    ],
    correct: 1,
    explain: {
      am: "ጥሩ ምርመራ 10–15 ደቂቃ ይወስዳል።",
      he: "בדיקה טובה אורכת 10–15 דקות.",
      en: "A proper inspection takes 10–15 minutes.",
      ru: "Полный осмотр занимает 10–15 минут.",
      fr: "Une inspection correcte prend 10–15 minutes.",
    },
  },
];
