// Psychological-occupational diagnostic: question TEXT only (client-safe).
// The answer key (option scores) lives server-side in scoring.ts
// (OPTION_SCORES / scoreFor) and grading in psych-grading.ts; the client
// sends option indices, never scores, and never receives scores.
// CTO gate 5 (2026-11-01): one bank for everyone (COMMON + PRESSURE); the
// former per-community banks were removed. Only the display language is chosen.

export type PsychLanguage = "he" | "am" | "ru";
export const PSYCH_LANGUAGES: PsychLanguage[] = ["he", "am", "ru"];
export const LANGUAGE_LABEL: Record<PsychLanguage, string> = {
  he: "עברית",
  am: "አማርኛ",
  ru: "Русский",
};

export type Opt = { he: string; am?: string };
export type Q = {
  id: string;
  category: "motivation" | "self_control" | "safety" | "communication" | "stability" | "pressure";
  text: { he: string; am?: string };
  options: Opt[];
};

export const COMMON: Q[] = [
  { id: "q1", category: "motivation", text: { he: "למה בחרת להיות נהג אוטובוס?", am: "ለምን አውቶቡስ ሹፌር ለመሆን መረጥክ?" }, options: [
    { he: "זה הדבר היחיד שמצאתי" },
    { he: "הכסף טוב" },
    { he: "אני אוהב לנהוג ולעזור לאנשים" },
    { he: "זה מקצוע יציב עם עתיד" },
  ]},
  { id: "q2", category: "self_control", text: { he: "נוסע צועק עליך — מה אתה עושה?", am: "ተሳፋሪ ይጮኻል — ምን ታደርጋለህ?" }, options: [
    { he: "צועק בחזרה" },
    { he: "מתעלם" },
    { he: "עוצר ומסביר בשקט" },
    { he: "מתנצל ומרגיע" },
  ]},
  { id: "q3", category: "safety", text: { he: "מצאת תקלה ברכב לפני יציאה — מה אתה עושה?" }, options: [
    { he: "יוצא בכל זאת" },
    { he: "מדווח אבל יוצא" },
    { he: "מדווח ומחכה לאישור" },
    { he: "לא יוצא ללא תיקון" },
  ]},
  { id: "q4", category: "safety", text: { he: "כמה שעות נהיגה ברצף מותר?" }, options: [
    { he: "כמה שצריך" },
    { he: "6-8 שעות" },
    { he: "עד 4.5 שעות לפי החוק" },
    { he: "תלוי במצב" },
  ]},
  { id: "q5", category: "motivation", text: { he: "נכשלת במבחן — מה אתה עושה?" }, options: [
    { he: "מוותר" },
    { he: "מחכה הרבה זמן" },
    { he: "מנסה שוב אחרי מנוחה" },
    { he: "מבין מה לא עבד ומנסה" },
  ]},
  { id: "q6", category: "stability", text: { he: "המשפחה תומכת שתהיה נהג אוטובוס?" }, options: [
    { he: "לא, נגד" },
    { he: "לא בטוח" },
    { he: "כן, עם חששות" },
    { he: "כן, לגמרי" },
  ]},
  { id: "q7", category: "communication", text: { he: "לא הבנת הוראה בעברית — מה אתה עושה?" }, options: [
    { he: "מעמיד פנים שהבנת" },
    { he: "עושה מה שנראה נכון" },
    { he: "שואל חבר אחר כך" },
    { he: "מבקש הסבר מיד" },
  ]},
  { id: "q8", category: "motivation", text: { he: "כמה שעות בשבוע מוכן ללמוד תיאוריה?" }, options: [
    { he: "שעה-שעתיים" },
    { he: "3-4 שעות" },
    { he: "5-7 שעות" },
    { he: "כמה שצריך" },
  ]},
  { id: "q9", category: "stability", text: { he: "מה השכר שאתה מצפה?" }, options: [
    { he: "מעל 15,000 ₪ מיד" },
    { he: "12,000-15,000 ₪" },
    { he: "8,000-12,000 ₪" },
    { he: "מוכן להתחיל בפחות ולצמוח" },
  ]},
  { id: "q10", category: "communication", text: { he: "תאר את עצמך כנהג:" }, options: [
    { he: "מהיר ויעיל" },
    { he: "סבלני ומכבד" },
    { he: "מקצועי ובטיחותי" },
    { he: "אדיב ושירותי" },
  ]},
];

export const PRESSURE: Q = {
  id: "qp", category: "pressure",
  text: { he: "אתה נוסע עם 40 נוסעים — שמעת צליל מוזר מהמנוע. מה אתה עושה?" },
  options: [
    { he: "ממשיך — כנראה לא חמור" },
    { he: "מאט ומגיע לתחנה הבאה" },
    { he: "עוצר בצד בבטחה ומדווח" },
    { he: "מתקשר למנהל תוך כדי נסיעה" },
  ],
};


/** The single bank, in display order. */
export const PSYCH_QUESTIONS: Q[] = [...COMMON, PRESSURE];
export const PSYCH_QUESTION_IDS: string[] = PSYCH_QUESTIONS.map((q) => q.id);
