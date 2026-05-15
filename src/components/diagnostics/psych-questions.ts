export type Community = "ethiopian" | "russian" | "manashe";
export type Category = "motivation" | "selfControl" | "safety" | "communication" | "support" | "scenario" | "community";
export type Question = {
  id: string;
  he: string;
  am?: string;
  options: { he: string; score: number }[];
  category: Category;
  tag?: string;
};

export const COMMUNITIES = [
  { id: "ethiopian" as const, label: "אתיופי", flag: "🇪🇹", greeting: "ברוך הבא! נשמח להכיר אותך.", greetingAm: "እንኳን ደህና መጡ!" },
  { id: "russian" as const, label: "רוסי", flag: "🇷🇺", greeting: "ברוך הבא! ספר לנו על עצמך.", greetingAm: "Добро пожаловать!" },
  { id: "manashe" as const, label: "שבט המנשה", flag: "✡️", greeting: "ברוכים הבאים לישראל ולמסע המקצועי.", greetingAm: "ברוכים הבאים." },
];

const o = (he: string, score: number) => ({ he, score });

export const CORE_QUESTIONS: Question[] = [
  { id: "q1", category: "motivation", he: "למה בחרת להיות נהג אוטובוס?", am: "የአውቶቡስ ሹፌር ለመሆን ለምን መረጥክ?", options: [o("זה הדבר היחיד שמצאתי",1), o("הכסף טוב",2), o("אני אוהב לנהוג ולעזור לאנשים",3), o("זה מקצוע יציב עם עתיד",4)] },
  { id: "q2", category: "selfControl", he: "נוסע צועק עליך באוטובוס — מה אתה עושה?", am: "ተሳፋሪ ይጮኻል — ምን ታደርጋለህ?", options: [o("צועק בחזרה",1), o("מתעלם לחלוטין",2), o("עוצר ומסביר בשקט",3), o("מתנצל ומנסה להרגיע",4)] },
  { id: "q3", category: "safety", he: "מצאת תקלה קטנה ברכב לפני יציאה — מה אתה עושה?", am: "ትንሽ ብልሽት አገኘህ — ምን ታደርጋለህ?", options: [o("יוצא בכל זאת, זה לא חמור",1), o("מדווח אבל יוצא אם אין תשובה",2), o("מדווח ומחכה לאישור",3), o("מדווח ולא יוצא ללא תיקון",4)] },
  { id: "q4", category: "safety", he: "כמה שעות נהיגה ברצף אתה חושב שמותר?", am: "ስንት ሰዓት ቀጥታ መ