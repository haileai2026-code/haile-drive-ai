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
