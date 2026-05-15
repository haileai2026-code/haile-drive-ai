export type Community = "ethiopian" | "russian" | "manashe";
export type Category =
  | "motivation"
  | "selfControl"
  | "safety"
  | "communication"
  | "support"
  | "scenario"
  | "community";

export type Option = { he: string; score: number };
export type Question = {
  id: string;
  he: string;
  am?: string;
  options: Option[];
  category: Category;
  tag?: string;
};

export const COMMUNITIES: { id: Community; label: string; flag: string; greeting: string; greetingAm: string }[] = [
  { id: "ethiopian", label: "אתיופי", flag: "\u{1F1EA}\u{1F1F9}", greeting: "ברוך הבא! נשמח להכיר אותך.", greetingAm: "እንኳን ደህና መጡ!" },
  { id: "russian", label: "רוסי", flag: "\u{1F1F7}\u{1F1FA}", greeting: "ברוך הבא! ספר לנו על עצמך.", greetingAm: "Добро пожаловать!" },
  { id: "manashe", label: "שבט המנשה", flag: "\u{2721}\u{FE0F}", greeting: "ברוכים הבאים לישראל ולמסע המקצועי.", greetingAm: "ברוכים הבאים." },
];

export const CORE_QUESTIONS: Question[] = [
  { id: "q1", category: "motivation", he: "למה בחרת להיות נהג אוטובוס?", am: "የአውቶቡስ ሹፌር ለመሆን ለምን መረጥክ?", options: [
    { he: "זה הדבר היחיד שמצאתי", score: 1 },
    { he: "הכסף טוב", score: 2 },
    { he: "אני אוהב לנהוג ולעזור לאנשים", score: 3 },
    { he: "זה מקצוע יציב עם עתיד", score: 4 },
  ]},
  { id: "q2", category: "selfControl", he: "נוסע צועק עליך באוטובוס — מה אתה עושה?", am: "ተሳፋሪ ይጮኻል — ምን ታደርጋለህ?", options: [
    { he: "צועק בחזרה", score: 1 },
    { he: "מתעלם לחלוטין", score: 2 },
    { he: "עוצר ומסביר בשקט", score: 3 },
    { he: "מתנצל ומנסה להרגיע", score: 4 },
  ]},
  { id: "q3", category: "safety", he: "מצאת תקלה קטנה ברכב לפני יציאה — מה אתה עושה?", am: "ትንሽ ብልሽት አገኘህ — ምን ታደርጋለህ?", options: [
    { he: "יוצא בכל זאת, זה לא חמור", score: 1 },
    { he: "מדווח אבל יוצא אם אין תשובה", score: 2 },
    { he: "מדווח ומחכה לאישור", score: 3 },
    { he: "מדווח ולא יוצא ללא תיקון", score: 4 },
  ]},
  { id: "q4", category: "safety", he: "כמה שעות נהיגה ברצף אתה חושב שמותר?", am: "ስንት ሰዓት ቀጥታ መንዳት ይፈቀዳል?", options: [
    { he: "כמה שצריך", score: 1 },
    { he: "6-8 שעות", score: 2 },
    { he: "עד 4.5 שעות לפי החוק", score: 3 },
    { he: "תלוי במצב הכביש", score: 4 },
  ]},
  { id: "q5", category: "motivation", he: "אחרי כישלון במבחן — מה אתה עושה?", am: "ከውድቀት በኋላ ምን ታደርጋለህ?", options: [
    { he: "מוותר, זה לא בשבילי", score: 1 },
    { he: "מחכה הרבה זמן לפני שמנסה שוב", score: 2 },
    { he: "מנסה שוב אחרי מנוחה קצרה", score: 3 },
    { he: "מבין מה לא עבד ומנסה שוב", score: 4 },
  ]},
  { id: "q6", category: "support", he: "המשפחה שלך תומכת שתהיה נהג אוטובוס?", am: "ቤተሰብህ ይደግፋል?", options: [
    { he: "לא, הם נגד", score: 1 },
    { he: "לא בטוח", score: 2 },
    { he: "כן, אבל עם חששות", score: 3 },
    { he: "כן, לגמרי תומכים", score: 4 },
  ]},
  { id: "q7", category: "communication", he: "לא הבנת הוראה בעברית — מה אתה עושה?", am: "በዕብራይስጥ አልተረዳህም — ምን ታደርጋለህ?", options: [
    { he: "מעמיד פנים שהבנת", score: 1 },
    { he: "עושה מה שנראה לך נכון", score: 2 },
    { he: "שואל חבר לאחר מכן", score: 3 },
    { he: "מבקש הסבר מחדש מיד", score: 4 },
  ]},
  { id: "q8", category: "motivation", he: "כמה שעות בשבוע אתה מוכן ללמוד תיאוריה?", am: "በሳምንት ስንት ሰዓት ለማጥናት ዝግጁ?", options: [
    { he: "שעה-שעתיים", score: 1 },
    { he: "3-4 שעות", score: 2 },
    { he: "5-7 שעות", score: 3 },
    { he: "כ
