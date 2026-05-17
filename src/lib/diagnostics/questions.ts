import type { DiagLanguage } from "./interfaces";

export type Community = "ethiopian" | "russian" | "manashe";

export type QOption = { he: string; am?: string; ru?: string; score: number };
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
    { he: "זה הדבר היחיד שמצאתי", score: 1 },
    { he: "הכסף טוב", score: 2 },
    { he: "אני אוהב לנהוג ולעזור לאנשים", score: 4 },
    { he: "מקצוע יציב עם עתיד", score: 3 },
  ]},
  { id: "q2", category: "self_control", text: { he: "נוסע צועק עליך — מה אתה עושה?", am: "ተሳፋሪ ይጮኻል — ምን ታደርጋለህ?", ru: "Пассажир кричит на тебя — что ты делаешь?" }, options: [
    { he: "צועק בחזרה", score: 1 },
    { he: "מתעלם", score: 2 },
    { he: "עוצר ומסביר בשקט", score: 4 },
    { he: "מתנצל ומרגיע", score: 3 },
  ]},
  { id: "q3", category: "safety", text: { he: "מצאת תקלה ברכב לפני יציאה — מה אתה עושה?", ru: "Нашёл неисправность перед выездом — что делаешь?" }, options: [
    { he: "יוצא בכל זאת", score: 1 },
    { he: "מדווח אבל יוצא", score: 2 },
    { he: "מדווח ומחכה לאישור", score: 4 },
    { he: "לא יוצא ללא תיקון", score: 4 },
  ]},
  { id: "q4", category: "safety", text: { he: "כמה שעות נהיגה ברצף מותר?", ru: "Сколько часов вождения подряд разрешено?" }, options: [
    { he: "כמה שצריך", score: 1 },
    { he: "6-8 שעות", score: 2 },
    { he: "עד 4.5 שעות לפי החוק", score: 4 },
    { he: "תלוי במצב", score: 2 },
  ]},
  { id: "q5", category: "motivation", text: { he: "נכשלת במבחן — מה אתה עושה?", ru: "Не сдал экзамен — что делаешь?" }, options: [
    { he: "מוותר", score: 1 },
    { he: "מחכה הרבה זמן", score: 2 },
    { he: "מנסה שוב אחרי מנוחה", score: 3 },
    { he: "מבין מה לא עבד ומנסה", score: 4 },
  ]},
  { id: "q6", category: "stability", text: { he: "המשפחה תומכת שתהיה נהג אוטובוס?", ru: "Семья поддерживает твой выбор?" }, options: [
    { he: "לא, נגד", score: 1 },
    { he: "לא בטוח", score: 2 },
    { he: "כן, עם חששות", score: 3 },
    { he: "כן, לגמרי", score: 4 },
  ]},
  { id: "q7", category: "communication", text: { he: "לא הבנת הוראה בעברית — מה אתה עושה?", ru: "Не понял указание на иврите — что делаешь?" }, options: [
    { he: "מעמיד פנים שהבנת", score: 1 },
    { he: "עושה מה שנראה נכון", score: 2 },
    { he: "שואל חבר אחר כך", score: 3 },
    { he: "מבקש הסבר מיד", score: 4 },
  ]},
  { id: "q8", category: "motivation", text: { he: "כמה שעות בשבוע מוכן ללמוד תיאוריה?", ru: "Сколько часов в неделю готов учить теорию?" }, options: [
    { he: "שעה-שעתיים", score: 1 },
    { he: "3-4 שעות", score: 2 },
    { he: "5-7 שעות", score: 3 },
    { he: "כמה שצריך", score: 4 },
  ]},
  { id: "q9", category: "stability", text: { he: "מה השכר שאתה מצפה?", ru: "Какую зарплату ожидаешь?" }, options: [
    { he: "מעל 15,000 ₪ מיד", score: 1 },
    { he: "12,000-15,000 ₪", score: 2 },
    { he: "8,000-12,000 ₪", score: 3 },
    { he: "מוכן להתחיל בפחות ולצמוח", score: 4 },
  ]},
  { id: "q10", category: "communication", text: { he: "תאר את עצמך כנהג:", ru: "Опиши себя как водителя:" }, options: [
    { he: "מהיר ויעיל", score: 2 },
    { he: "סבלני ומכבד", score: 4 },
    { he: "מקצועי ובטיחותי", score: 4 },
    { he: "אדיב ושירותי", score: 3 },
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
    { he: "ממשיך — כנראה לא חמור", score: 1 },
    { he: "מאט ומגיע לתחנה הבאה", score: 2 },
    { he: "עוצר בצד בבטחה ומדווח", score: 4 },
    { he: "מתקשר למנהל תוך כדי נסיעה", score: 2 },
  ],
};

export const BY_COMMUNITY: Record<Community, DiagQuestion[]> = {
  ethiopian: [
    { id: "qe1", category: "stability", text: { he: "אם לא עברת מבחן — מה תגיד למשפחה?", am: "ፈተናውን ካላለፍክ ለቤተሰብ ምን ትላለህ?" }, options: [
      { he: "אסתיר", score: 1 }, { he: "אגיד שדחיתי", score: 2 }, { he: "אגיד האמת ואנסה שוב", score: 4 },
    ]},
    { id: "qe2", category: "motivation", text: { he: "פחדת פעם מכישלון ועשית בכל זאת — ספר", am: "ከውድቀት ፈርተህ ግን ሞክረሃል?" }, options: [
      { he: "לא קרה", score: 1 }, { he: "רק אם הייתי חייב", score: 2 }, { he: "כן, תמיד אנסה", score: 4 },
    ]},
    { id: "qe3", category: "stability", text: { he: "אדם שאתה מכבד — מה היה אומר על המקצוע?", am: "የምታከብረው ሰው ስለዚህ ሙያ ምን ይላል?" }, options: [
      { he: "לא בטוח", score: 1 }, { he: "היה מסכים", score: 3 }, { he: "היה גאה", score: 4 },
    ]},
  ],
  russian: [
    { id: "qr1", category: "motivation", text: { he: "מה עשית מקצועית לפני שהגעת לישראל?", ru: "Чем ты занимался до приезда в Израиль?" }, options: [
      { he: "לא רלוונטי", score: 1 }, { he: "עבדתי בתחום שונה", score: 2 }, { he: "יש לי ניסיון תחבורה", score: 4 },
    ]},
    { id: "qr2", category: "self_control", text: { he: "מנהל ביקש משהו שנראה לך לא נכון — מה תעשה?", ru: "Начальник просит сделать что-то странное — что делаешь?" }, options: [
      { he: "אתעלם", score: 1 }, { he: "אעשה אבל אתלונן", score: 2 }, { he: "אשאל לפני שאעשה", score: 4 },
    ]},
    { id: "qr3", category: "stability", text: { he: "בעוד 3 שנים — איפה אתה רוצה להיות?", ru: "Где ты хочешь быть через 3 года?" }, options: [
      { he: "לא יודע", score: 1 }, { he: "אותו מקום", score: 2 }, { he: "נהג מנוסה / מדריך", score: 4 },
    ]},
  ],
  manashe: [
    { id: "qm1", category: "motivation", text: { he: "למה בחרת לעלות לישראל?" }, options: [
      { he: "הגעתי עם המשפחה", score: 2 }, { he: "חיפשתי עבודה", score: 2 }, { he: "זה החלום שלי מאז ילדות", score: 4 },
    ]},
    { id: "qm2", category: "stability", text: { he: "מוכן לנסוע כל יום לעיר אחרת?" }, options: [
      { he: "לא", score: 1 }, { he: "רק קרוב לבית", score: 2 }, { he: "כן, בלי בעיה", score: 4 },
    ]},
    { id: "qm3", category: "motivation", text: { he: "ספר על עבודה קשה שעשית בחיים" }, options: [
      { he: "לא עשיתי", score: 1 }, { he: "עבדתי קשה כשהייתי חייב", score: 2 }, { he: "תמיד עבדתי קשה", score: 4 },
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
