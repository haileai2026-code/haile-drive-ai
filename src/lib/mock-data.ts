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

export type Lesson = {
  id: string;
  title: { am: string; he: string; en: string };
  category: LessonCategory;
  duration: number; // minutes
  progress: number; // 0..100
  thumbnailHue: number;
};

export const lessons: Lesson[] = [
  { id: "air-brakes-1", title: { am: "የአየር ብሬክ መሰረታዊ", he: "מערכת בלמי אוויר", en: "Air Brake Basics" }, category: "air-brakes", duration: 18, progress: 100, thumbnailHue: 45 },
  { id: "pre-trip-1", title: { am: "የቅድመ ጉዞ ምርመራ", he: "בדיקה לפני נסיעה", en: "Pre-trip Inspection" }, category: "pre-trip", duration: 22, progress: 60, thumbnailHue: 80 },
  { id: "signs-1", title: { am: "የመንገድ ምልክቶች 1", he: "תמרורי דרך 1", en: "Road Signs I" }, category: "road-signs", duration: 14, progress: 35, thumbnailHue: 200 },
  { id: "passenger-1", title: { am: "የመንገደኛ ደህንነት", he: "בטיחות נוסעים", en: "Passenger Safety" }, category: "passenger-safety", duration: 20, progress: 0, thumbnailHue: 12 },
  { id: "emergency-1", title: { am: "አደጋ ጊዜ ሁኔታዎች", he: "מצבי חירום", en: "Emergency Situations" }, category: "emergency", duration: 24, progress: 0, thumbnailHue: 0 },
  { id: "terms-1", title: { am: "ሙያዊ ቃላት", he: "מונחים מקצועיים", en: "Professional Terms" }, category: "terminology", duration: 12, progress: 0, thumbnailHue: 280 },
];

export const sampleQuestions = [
  {
    id: "q1",
    q: { am: "የአየር ብሬክ ዝቅተኛ ግፊት ማስጠንቀቂያ መቼ ይከሰታል?", he: "מתי מופעלת התראת לחץ אוויר נמוך?", en: "When does the low air-pressure warning activate?" },
    options: [
      { am: "ከ60 PSI በታች ሲሆን", he: "מתחת ל-60 PSI", en: "Below 60 PSI" },
      { am: "ከ100 PSI በላይ", he: "מעל 100 PSI", en: "Above 100 PSI" },
      { am: "ሞተር ሲጠፋ ብቻ", he: "רק כשהמנוע כבוי", en: "Only when engine is off" },
    ],
    correct: 0,
    explain: { am: "ግፊቱ ከ60 PSI በታች ሲወርድ ማስጠንቀቂያው ይሰራል።", he: "ההתראה פועלת כשהלחץ יורד מתחת ל-60 PSI.", en: "The warning triggers when pressure drops below 60 PSI." },
  },
  {
    id: "q2",
    q: { am: "የቅድመ ጉዞ ምርመራ ምን ያህል ጊዜ ይወስዳል?", he: "כמה זמן לוקחת בדיקה לפני נסיעה?", en: "How long should a pre-trip inspection take?" },
    options: [
      { am: "1 ደቂቃ", he: "דקה", en: "1 minute" },
      { am: "10–15 ደቂቃ", he: "10–15 דקות", en: "10–15 minutes" },
      { am: "1 ሰዓት", he: "שעה", en: "1 hour" },
    ],
    correct: 1,
    explain: { am: "ጥሩ ምርመራ 10–15 ደቂቃ ይወስዳል።", he: "בדיקה טובה אורכת 10–15 דקות.", en: "A proper inspection takes 10–15 minutes." },
  },
];
