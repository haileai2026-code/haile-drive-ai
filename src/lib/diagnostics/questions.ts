
export type QOption = { he: string; am?: string; ru?: string };
export type DiagQuestion = {
  id: string;
  category: "motivation" | "self_control" | "safety" | "communication" | "stability" | "pressure";
  text: { he: string; am?: string; ru?: string };
  options: QOption[];
};

// CTO gate 5 (2026-11-01): one bank for everyone; the chooser selects the
// display / TTS language only (stored as a language code).
export type DiagDisplayLanguage = "he" | "am" | "ru";
export const DIAG_LANGUAGES: DiagDisplayLanguage[] = ["he", "am", "ru"];
export const LANGUAGE_LABEL: Record<DiagDisplayLanguage, string> = {
  he: "עברית",
  am: "አማርኛ",
  ru: "Русский",
};

// 10 common questions
export const COMMON: DiagQuestion[] = [
  { id: "q1", category: "motivation", text: { he: "למה בחרת להיות נהג אוטובוס?", am: "ለምን አውቶቡስ ሹፌር ለመሆን መረጥክ?", ru: "Почему ты выбрал быть водителем автобуса?" }, options: [
    { he: "זה הדבר היחיד שמצאתי" },
    { he: "הכסף טוב" },
    { he: "אני אוהב לנהוג ולעזור לאנשים" },
    { he: "מקצוע יציב עם עתיד" },
  ]},
  { id: "q2", category: "self_control", text: { he: "נוסע צועק עליך — מה אתה עושה?", am: "ተሳፋሪ ይጮኻል — ምን ታደርጋለህ?", ru: "Пассажир кричит на тебя — что ты делаешь?" }, options: [
    { he: "צועק בחזרה" },
    { he: "מתעלם" },
    { he: "עוצר ומסביר בשקט" },
    { he: "מתנצל ומרגיע" },
  ]},
  { id: "q3", category: "safety", text: { he: "מצאת תקלה ברכב לפני יציאה — מה אתה עושה?", ru: "Нашёл неисправность перед выездом — что делаешь?" }, options: [
    { he: "יוצא בכל זאת" },
    { he: "מדווח אבל יוצא" },
    { he: "מדווח ומחכה לאישור" },
    { he: "לא יוצא ללא תיקון" },
  ]},
  { id: "q4", category: "safety", text: { he: "כמה שעות נהיגה ברצף מותר?", ru: "Сколько часов вождения подряд разрешено?" }, options: [
    { he: "כמה שצריך" },
    { he: "6-8 שעות" },
    { he: "עד 4.5 שעות לפי החוק" },
    { he: "תלוי במצב" },
  ]},
  { id: "q5", category: "motivation", text: { he: "נכשלת במבחן — מה אתה עושה?", ru: "Не сдал экзамен — что делаешь?" }, options: [
    { he: "מוותר" },
    { he: "מחכה הרבה זמן" },
    { he: "מנסה שוב אחרי מנוחה" },
    { he: "מבין מה לא עבד ומנסה" },
  ]},
  { id: "q6", category: "stability", text: { he: "המשפחה תומכת שתהיה נהג אוטובוס?", ru: "Семья поддерживает твой выбор?" }, options: [
    { he: "לא, נגד" },
    { he: "לא בטוח" },
    { he: "כן, עם חששות" },
    { he: "כן, לגמרי" },
  ]},
  { id: "q7", category: "communication", text: { he: "לא הבנת הוראה בעברית — מה אתה עושה?", ru: "Не понял указание на иврите — что делаешь?" }, options: [
    { he: "מעמיד פנים שהבנת" },
    { he: "עושה מה שנראה נכון" },
    { he: "שואל חבר אחר כך" },
    { he: "מבקש הסבר מיד" },
  ]},
  { id: "q8", category: "motivation", text: { he: "כמה שעות בשבוע מוכן ללמוד תיאוריה?", ru: "Сколько часов в неделю готов учить теорию?" }, options: [
    { he: "שעה-שעתיים" },
    { he: "3-4 שעות" },
    { he: "5-7 שעות" },
    { he: "כמה שצריך" },
  ]},
  { id: "q9", category: "stability", text: { he: "מה השכר שאתה מצפה?", ru: "Какую зарплату ожидаешь?" }, options: [
    { he: "מעל 15,000 ₪ מיד" },
    { he: "12,000-15,000 ₪" },
    { he: "8,000-12,000 ₪" },
    { he: "מוכן להתחיל בפחות ולצמוח" },
  ]},
  { id: "q10", category: "communication", text: { he: "תאר את עצמך כנהג:", ru: "Опиши себя как водителя:" }, options: [
    { he: "מהיר ויעיל" },
    { he: "סבלני ומכבד" },
    { he: "מקצועי ובטיחותי" },
    { he: "אדיב ושירותי" },
  ]},
];

// Pressure scenario (timed 20s)
export const PRESSURE: DiagQuestion = {
  id: "qp", category: "pressure",
  text: {
    he: "אתה נוסע עם 40 נוסעים — שמעת צליל מוזר מהמנוע. מה אתה עושה?",
    am: "ከ40 ተሳፋሪዎች ጋር እየነዳህ ነው — ከሞተሩ እንግዳ ድምፅ ሰምተሃል። ምን ታደርጋለህ?",
    ru: "Ты везёшь 40 пассажиров — слышишь странный звук из двигателя. Что делаешь?",
  },
  options: [
    { he: "ממשיך — כנראה לא חמור" },
    { he: "מאט ומגיע לתחנה הבאה" },
    { he: "עוצר בצד בבטחה ומדווח" },
    { he: "מתקשר למנהל תוך כדי נסיעה" },
  ],
};

/** The single bank, in display order (pressure question last). */
export const DIAG_QUESTIONS: DiagQuestion[] = [...COMMON, PRESSURE];
export const DIAG_QUESTION_IDS: string[] = DIAG_QUESTIONS.map((q) => q.id);

export function questionsFor(): DiagQuestion[] {
  return DIAG_QUESTIONS;
}

export function ttsTextFor(q: DiagQuestion, lang: DiagDisplayLanguage): string {
  if (lang === "am" && q.text.am) return q.text.am;
  if (lang === "ru" && q.text.ru) return q.text.ru;
  return q.text.he;
}
