import type { DiagLanguage } from "./interfaces";

export type Community = "ethiopian" | "russian" | "manashe";

export type QOption = { he: string; am?: string; ru?: string };
export type DiagQuestion = {
  id: string;
  category: "motivation" | "self_control" | "safety" | "communication" | "stability" | "pressure" | "community";
  text: { he: string; am?: string; ru?: string };
  options: QOption[];
};

export const COMMUNITY_LABEL: Record<Community, string> = {
  ethiopian: "🇪🇹 אמהרית",
  russian: "🇷🇺 רוסית",
  manashe: "✡️ קוקי (בני מנשה)",
};

export const COMMUNITY_TTS_LANG: Record<Community, DiagLanguage> = {
  ethiopian: "am",
  russian: "ru",
  manashe: "he",
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

export const BY_COMMUNITY: Record<Community, DiagQuestion[]> = {
  ethiopian: [
    { id: "qe1", category: "stability", text: { he: "אם לא עברת מבחן — מה תגיד למשפחה?", am: "ፈተናውን ካላለፍክ ለቤተሰብ ምን ትላለህ?" }, options: [
      { he: "אסתיר" }, { he: "אגיד שדחיתי" }, { he: "אגיד האמת ואנסה שוב" },
    ]},
    { id: "qe2", category: "motivation", text: { he: "פחדת פעם מכישלון ועשית בכל זאת — ספר", am: "ከውድቀት ፈርተህ ግን ሞክረሃል?" }, options: [
      { he: "לא קרה" }, { he: "רק אם הייתי חייב" }, { he: "כן, תמיד אנסה" },
    ]},
    { id: "qe3", category: "stability", text: { he: "אדם שאתה מכבד — מה היה אומר על המקצוע?", am: "የምታከብረው ሰው ስለዚህ ሙያ ምን ይላል?" }, options: [
      { he: "לא בטוח" }, { he: "היה מסכים" }, { he: "היה גאה" },
    ]},
  ],
  russian: [
    { id: "qr1", category: "motivation", text: { he: "מה עשית מקצועית לפני שהגעת לישראל?", ru: "Чем ты занимался до приезда в Израиль?" }, options: [
      { he: "לא רלוונטי" }, { he: "עבדתי בתחום שונה" }, { he: "יש לי ניסיון תחבורה" },
    ]},
    { id: "qr2", category: "self_control", text: { he: "מנהל ביקש משהו שנראה לך לא נכון — מה תעשה?", ru: "Начальник просит сделать что-то странное — что делаешь?" }, options: [
      { he: "אתעלם" }, { he: "אעשה אבל אתלונן" }, { he: "אשאל לפני שאעשה" },
    ]},
    { id: "qr3", category: "stability", text: { he: "בעוד 3 שנים — איפה אתה רוצה להיות?", ru: "Где ты хочешь быть через 3 года?" }, options: [
      { he: "לא יודע" }, { he: "אותו מקום" }, { he: "נהג מנוסה / מדריך" },
    ]},
  ],
  manashe: [
    { id: "qm1", category: "motivation", text: { he: "למה בחרת לעלות לישראל?" }, options: [
      { he: "הגעתי עם המשפחה" }, { he: "חיפשתי עבודה" }, { he: "זה החלום שלי מאז ילדות" },
    ]},
    { id: "qm2", category: "stability", text: { he: "מוכן לנסוע כל יום לעיר אחרת?" }, options: [
      { he: "לא" }, { he: "רק קרוב לבית" }, { he: "כן, בלי בעיה" },
    ]},
    { id: "qm3", category: "motivation", text: { he: "ספר על עבודה קשה שעשית בחיים" }, options: [
      { he: "לא עשיתי" }, { he: "עבדתי קשה כשהייתי חייב" }, { he: "תמיד עבדתי קשה" },
    ]},
  ],
};

export function questionsFor(community: Community): DiagQuestion[] {
  return [...COMMON, ...BY_COMMUNITY[community], PRESSURE];
}

export function ttsTextFor(q: DiagQuestion, community: Community): string {
  if (community === "ethiopian" && q.text.am) return q.text.am;
  if (community === "russian" && q.text.ru) return q.text.ru;
  return q.text.he;
}
