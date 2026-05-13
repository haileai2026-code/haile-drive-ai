import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type Lang = "am" | "he" | "en";

type Dict = Record<string, string>;

const dictionaries: Record<Lang, Dict> = {
  am: {
    appName: "ሃይሌ ድራይቭ AI",
    tagline: "በራስዎ ቋንቋ ሙያዊ መንዳት ይማሩ።",
    heroSub: "ለአውቶቡስና ለከባድ ተሽከርካሪ ፈቃድ የተዘጋጀ AI አስተማሪ — በአማርኛ፣ በዕብራይስጥ እና በእንግሊዘኛ።",
    getStarted: "ጀምር",
    login: "ግባ",
    phone: "ስልክ ቁጥር",
    sendCode: "ኮድ ላክ",
    enterOtp: "ኮዱን ያስገቡ",
    verify: "አረጋግጥ",
    dashboard: "ዳሽቦርድ",
    lessons: "ትምህርቶች",
    aiTeacher: "AI አስተማሪ",
    quiz: "ፈተና",
    community: "ማህበረሰብ",
    profile: "መገለጫ",
    welcome: "እንኳን ደህና መጣህ",
    yourProgress: "የእርስዎ እድገት",
    upcomingTest: "የሚመጣ ፈተና",
    continueLesson: "ትምህርትዎን ይቀጥሉ",
    motivation: "ዛሬ አንድ ትምህርት ይጨርሱ — እያንዳንዱ ቀን አስፈላጊ ነው።",
    askAnything: "ስለ መንዳት ማንኛውንም ይጠይቁ…",
    startQuiz: "ፈተና ጀምር",
    completed: "ተጠናቋል",
    minutes: "ደቂቃ",
  },
  he: {
    appName: "Haile Drive AI",
    tagline: "למד נהיגה מקצועית עם AI בשפה שלך.",
    heroSub: "מורה AI לרישיון אוטובוס ומשאיות כבדות — באמהרית, עברית ואנגלית.",
    getStarted: "התחל",
    login: "התחברות",
    phone: "מספר טלפון",
    sendCode: "שלח קוד",
    enterOtp: "הכנס קוד",
    verify: "אמת",
    dashboard: "לוח בקרה",
    lessons: "שיעורים",
    aiTeacher: "מורה AI",
    quiz: "מבחן",
    community: "קהילה",
    profile: "פרופיל",
    welcome: "ברוך הבא",
    yourProgress: "ההתקדמות שלך",
    upcomingTest: "מבחן קרוב",
    continueLesson: "המשך בשיעור",
    motivation: "השלם שיעור אחד היום — כל יום חשוב.",
    askAnything: "שאל כל דבר על נהיגה…",
    startQuiz: "התחל מבחן",
    completed: "הושלם",
    minutes: "דקות",
  },
  en: {
    appName: "Haile Drive AI",
    tagline: "Learn professional driving with AI in your own language.",
    heroSub: "An AI instructor for bus & heavy-vehicle licenses — in Amharic, Hebrew and English.",
    getStarted: "Get started",
    login: "Sign in",
    phone: "Phone number",
    sendCode: "Send code",
    enterOtp: "Enter code",
    verify: "Verify",
    dashboard: "Dashboard",
    lessons: "Lessons",
    aiTeacher: "AI Teacher",
    quiz: "Quiz",
    community: "Community",
    profile: "Profile",
    welcome: "Welcome back",
    yourProgress: "Your progress",
    upcomingTest: "Upcoming test",
    continueLesson: "Continue lesson",
    motivation: "Finish one lesson today — every day counts.",
    askAnything: "Ask anything about driving…",
    startQuiz: "Start quiz",
    completed: "Completed",
    minutes: "min",
  },
};

const isRTL = (l: Lang) => l === "he" || l === "am";

type Ctx = {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: keyof typeof dictionaries.en) => string;
  dir: "rtl" | "ltr";
};

const I18nContext = createContext<Ctx | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("am");

  useEffect(() => {
    const saved = (typeof window !== "undefined" && localStorage.getItem("hda.lang")) as Lang | null;
    if (saved && ["am", "he", "en"].includes(saved)) setLangState(saved);
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.lang = lang;
    document.documentElement.dir = isRTL(lang) ? "rtl" : "ltr";
  }, [lang]);

  const setLang = (l: Lang) => {
    setLangState(l);
    if (typeof window !== "undefined") localStorage.setItem("hda.lang", l);
  };

  const t = (key: keyof typeof dictionaries.en) => dictionaries[lang][key] ?? dictionaries.en[key] ?? key;

  return (
    <I18nContext.Provider value={{ lang, setLang, t, dir: isRTL(lang) ? "rtl" : "ltr" }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used inside I18nProvider");
  return ctx;
}
