// Psychological-occupational diagnostic: question bank + scoring.
// Shared by the route (rendering) and the server function (grading).
// Grading happens ONLY on the server (beqa-submit.functions.ts); the client
// sends option indices, never scores.

export type Community = "ethiopian" | "russian" | "manashe";
export type Opt = { he: string; am?: string; score: number };
export type Q = {
  id: string;
  category: "motivation" | "self_control" | "safety" | "communication" | "stability" | "pressure" | "community";
  text: { he: string; am?: string };
  options: Opt[];
};

export const COMMON: Q[] = [
  { id: "q1", category: "motivation", text: { he: "למה בחרת להיות נהג אוטובוס?", am: "ለምን አውቶቡስ ሹፌር ለመሆን መረጥክ?" }, options: [
    { he: "זה הדבר היחיד שמצאתי", score: 1 },
    { he: "הכסף טוב", score: 2 },
    { he: "אני אוהב לנהוג ולעזור לאנשים", score: 4 },
    { he: "זה מקצוע יציב עם עתיד", score: 3 },
  ]},
  { id: "q2", category: "self_control", text: { he: "נוסע צועק עליך — מה אתה עושה?", am: "ተሳፋሪ ይጮኻል — ምን ታደርጋለህ?" }, options: [
    { he: "צועק בחזרה", score: 1 },
    { he: "מתעלם", score: 2 },
    { he: "עוצר ומסביר בשקט", score: 4 },
    { he: "מתנצל ומרגיע", score: 3 },
  ]},
  { id: "q3", category: "safety", text: { he: "מצאת תקלה ברכב לפני יציאה — מה אתה עושה?" }, options: [
    { he: "יוצא בכל זאת", score: 1 },
    { he: "מדווח אבל יוצא", score: 2 },
    { he: "מדווח ומחכה לאישור", score: 4 },
    { he: "לא יוצא ללא תיקון", score: 4 },
  ]},
  { id: "q4", category: "safety", text: { he: "כמה שעות נהיגה ברצף מותר?" }, options: [
    { he: "כמה שצריך", score: 1 },
    { he: "6-8 שעות", score: 2 },
    { he: "עד 4.5 שעות לפי החוק", score: 4 },
    { he: "תלוי במצב", score: 2 },
  ]},
  { id: "q5", category: "motivation", text: { he: "נכשלת במבחן — מה אתה עושה?" }, options: [
    { he: "מוותר", score: 1 },
    { he: "מחכה הרבה זמן", score: 2 },
    { he: "מנסה שוב אחרי מנוחה", score: 3 },
    { he: "מבין מה לא עבד ומנסה", score: 4 },
  ]},
  { id: "q6", category: "stability", text: { he: "המשפחה תומכת שתהיה נהג אוטובוס?" }, options: [
    { he: "לא, נגד", score: 1 },
    { he: "לא בטוח", score: 2 },
    { he: "כן, עם חששות", score: 3 },
    { he: "כן, לגמרי", score: 4 },
  ]},
  { id: "q7", category: "communication", text: { he: "לא הבנת הוראה בעברית — מה אתה עושה?" }, options: [
    { he: "מעמיד פנים שהבנת", score: 1 },
    { he: "עושה מה שנראה נכון", score: 2 },
    { he: "שואל חבר אחר כך", score: 3 },
    { he: "מבקש הסבר מיד", score: 4 },
  ]},
  { id: "q8", category: "motivation", text: { he: "כמה שעות בשבוע מוכן ללמוד תיאוריה?" }, options: [
    { he: "שעה-שעתיים", score: 1 },
    { he: "3-4 שעות", score: 2 },
    { he: "5-7 שעות", score: 3 },
    { he: "כמה שצריך", score: 4 },
  ]},
  { id: "q9", category: "stability", text: { he: "מה השכר שאתה מצפה?" }, options: [
    { he: "מעל 15,000 ₪ מיד", score: 1 },
    { he: "12,000-15,000 ₪", score: 2 },
    { he: "8,000-12,000 ₪", score: 3 },
    { he: "מוכן להתחיל בפחות ולצמוח", score: 4 },
  ]},
  { id: "q10", category: "communication", text: { he: "תאר את עצמך כנהג:" }, options: [
    { he: "מהיר ויעיל", score: 2 },
    { he: "סבלני ומכבד", score: 4 },
    { he: "מקצועי ובטיחותי", score: 4 },
    { he: "אדיב ושירותי", score: 3 },
  ]},
];

export const PRESSURE: Q = {
  id: "qp", category: "pressure",
  text: { he: "אתה נוסע עם 40 נוסעים — שמעת צליל מוזר מהמנוע. מה אתה עושה?" },
  options: [
    { he: "ממשיך — כנראה לא חמור", score: 1 },
    { he: "מאט ומגיע לתחנה הבאה", score: 2 },
    { he: "עוצר בצד בבטחה ומדווח", score: 4 },
    { he: "מתקשר למנהל תוך כדי נסיעה", score: 2 },
  ],
};

export const BY_COMMUNITY: Record<Community, Q[]> = {
  ethiopian: [
    { id: "qe1", category: "stability", text: { he: "אם לא עברת מבחן — מה תגיד למשפחה?" }, options: [
      { he: "אסתיר", score: 1 }, { he: "אגיד שדחיתי", score: 2 }, { he: "אגיד האמת ואנסה שוב", score: 4 },
    ]},
    { id: "qe2", category: "motivation", text: { he: "פחדת פעם מכישלון ועשית בכל זאת — ספר" }, options: [
      { he: "לא קרה", score: 1 }, { he: "רק אם הייתי חייב", score: 2 }, { he: "כן, תמיד אנסה", score: 4 },
    ]},
    { id: "qe3", category: "stability", text: { he: "אדם שאתה מכבד — מה הוא היה אומר על המקצוע הזה?" }, options: [
      { he: "לא בטוח", score: 1 }, { he: "היה מסכים", score: 3 }, { he: "היה גאה", score: 4 },
    ]},
  ],
  russian: [
    { id: "qr1", category: "motivation", text: { he: "מה עשית מקצועית לפני שהגעת לישראל?" }, options: [
      { he: "לא רלוונטי", score: 1 }, { he: "עבדתי בתחום שונה", score: 2 }, { he: "יש לי ניסיון תחבורה", score: 4 },
    ]},
    { id: "qr2", category: "self_control", text: { he: "מנהל ישראלי ביקש משהו שנראה לך לא נכון — מה תעשה?" }, options: [
      { he: "אתעלם", score: 1 }, { he: "אעשה אבל אתלונן", score: 2 }, { he: "אשאל לפני שאעשה", score: 4 },
    ]},
    { id: "qr3", category: "stability", text: { he: "בעוד 3 שנים — איפה אתה רוצה להיות?" }, options: [
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

export function questionsForCommunity(community: Community): Q[] {
  return [...COMMON, PRESSURE, ...BY_COMMUNITY[community]];
}

// Score weights per spec
export function calcScore(answers: Record<string, number>): number {
  const get = (id: string) => answers[id] ?? 0;
  const avg = (ids: string[]) => {
    const vals = ids.map(get).filter((v) => v > 0);
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
  };
  const motivation = avg(["q1", "q5", "q8"]);
  const selfControl = avg(["q2", "qp"]);
  const safety = avg(["q3", "q4"]);
  const communication = avg(["q7", "q10"]);
  const stability = avg(["q6", "q9"]);
  const score =
    motivation * 0.25 +
    selfControl * 0.25 +
    safety * 0.20 +
    communication * 0.15 +
    stability * 0.15;
  return Math.round(score * 100) / 100;
}

export function recommendationFor(score: number): { letter: "A" | "B" | "C"; label: string } {
  if (score >= 4.0) return { letter: "A", label: "מומלץ מאוד להמשך תהליך" };
  if (score >= 3.0) return { letter: "B", label: "מומלץ ראיון נוסף" };
  return { letter: "C", label: "לא מומלץ כרגע" };
}

/**
 * Server-side grading. `picks` maps question id -> chosen option index.
 * Unknown question ids and out-of-range indices are rejected.
 */
export function gradePsych(community: Community, picks: Record<string, number>) {
  const qs = questionsForCommunity(community);
  const byId = new Map(qs.map((q) => [q.id, q]));
  const final: Record<string, number> = {};
  for (const [qId, idx] of Object.entries(picks)) {
    const q = byId.get(qId);
    if (!q) throw new Error(`unknown question ${qId}`);
    const opt = q.options[idx];
    if (!opt) throw new Error(`invalid option for ${qId}`);
    final[qId] = opt.score;
  }
  if (Object.keys(final).length !== qs.length) throw new Error("incomplete answers");
  const score = calcScore(final); // 1-4 scale
  const rec = recommendationFor(score);
  // Normalize to 0-100 scale for unified scoring/reporting
  const psychological100 = Math.round((score / 4) * 1000) / 10;
  const vals = Object.values(final);
  const accuracy100 = vals.length
    ? Math.round((vals.filter((v) => v >= 3).length / vals.length) * 1000) / 10
    : 0;
  // Without biometric data, final BEQA = psychological * 0.7 + accuracy * 0.3
  const finalBeqa = Math.round((psychological100 * 0.7 + accuracy100 * 0.3) * 10) / 10;
  return { final, score, rec, psychological100, accuracy100, finalBeqa };
}
