// BEQA — Biometric-Enhanced Quiz Assessment
// Spec: 10 questions (multiple choice, 4 options), 20s per question.
// BEQA = (Accuracy × 0.4) + (StressStability × 0.3) + (ReactionConsistency × 0.3)

export type StressQuestion = {
  id: string;
  text: string;
  options: string[];
  correctIndex: number;
};

export const STRESS_QUESTIONS: StressQuestion[] = [
  {
    id: "q1",
    text: "מהו מרחק העצירה הכולל של רכב הנוסע במהירות 90 קמ\"ש בכביש יבש?",
    options: ["כ-40 מטר", "כ-70 מטר", "כ-100 מטר", "כ-130 מטר"],
    correctIndex: 1,
  },
  {
    id: "q2",
    text: "באיזה מצב מותר לעקוף מימין?",
    options: [
      "תמיד כשיש מקום",
      "כשהרכב שלפניך מאותת שמאלה ופונה שמאלה",
      "בכביש חד-סטרי בלבד",
      "אסור לעקוף מימין בשום מצב",
    ],
    correctIndex: 1,
  },
  {
    id: "q3",
    text: "מה מרחק הבטיחות המינימלי מאחורי אוטובוס במהירות 80 קמ\"ש?",
    options: ["1 שניה", "2 שניות", "3 שניות", "5 שניות"],
    correctIndex: 2,
  },
  {
    id: "q4",
    text: "תמרור 'תן זכות קדימה' (משולש הפוך) מחייב את הנהג:",
    options: [
      "לעצור עצירה מוחלטת תמיד",
      "להאט ולתת זכות לרכב בדרך החוצה",
      "להמשיך בנסיעה רגילה",
      "להאיץ כדי להשתלב מהר",
    ],
    correctIndex: 1,
  },
  {
    id: "q5",
    text: "מהי הסנקציה על נהיגה תחת השפעת אלכוהול ברמה של פי 3 מהמותר?",
    options: [
      "קנס בלבד",
      "פסילת רישיון ל-3 חודשים",
      "פסילה מינהלית ל-30 יום + הגשת כתב אישום",
      "אזהרה בכתב",
    ],
    correctIndex: 2,
  },
  {
    id: "q6",
    text: "באיזו מהירות מקסימלית מותר לנסוע בדרך עירונית, אלא אם תמרור קובע אחרת?",
    options: ["40 קמ\"ש", "50 קמ\"ש", "60 קמ\"ש", "70 קמ\"ש"],
    correctIndex: 1,
  },
  {
    id: "q7",
    text: "מתי חובה להדליק אורות נמוכים ברכב?",
    options: [
      "רק בלילה",
      "רק בערפל",
      "תמיד בנסיעה בכביש בין-עירוני, גם ביום",
      "רק כשיורד גשם",
    ],
    correctIndex: 2,
  },
  {
    id: "q8",
    text: "ברמזור צהוב מהבהב, מה על הנהג לעשות?",
    options: [
      "לעצור עצירה מוחלטת",
      "להמשיך במהירות רגילה",
      "להאט ולהיכנס לצומת בזהירות",
      "לעצור רק אם יש הולכי רגל",
    ],
    correctIndex: 2,
  },
  {
    id: "q9",
    text: "מהו זמן התגובה הממוצע של נהג ער ומפוקס מרגע זיהוי מכשול ועד תחילת בלימה?",
    options: ["0.2 שניות", "0.7-1.0 שניות", "1.5 שניות", "2 שניות"],
    correctIndex: 1,
  },
  {
    id: "q10",
    text: "כשנהג מגלה שמערכת ה-ABS אינה תקינה (נורת אזהרה דולקת), עליו:",
    options: [
      "להמשיך בנסיעה רגילה — לא משפיע על בלימה",
      "להאט, להגביר מרחק ביטחון ולפנות למוסך בהקדם",
      "לעצור מיד באמצע הכביש",
      "להגביר מהירות כדי להגיע מהר למוסך",
    ],
    correctIndex: 1,
  },
];

const TIME_PER_QUESTION_MS = 20_000;

export const STRESS_TEST_CONFIG = {
  timePerQuestionMs: TIME_PER_QUESTION_MS,
  totalTimeMs: TIME_PER_QUESTION_MS * STRESS_QUESTIONS.length,
  // Attention probe (catch trial) per spec §3.1
  attentionProbeEveryNQuestions: 3,
  attentionProbeWindowMs: 1500,
};

// ---- Score components ----------------------------------------------------

// Accuracy [0–100]
export function computeAccuracy(correct: number, total: number): number {
  return (correct / Math.max(1, total)) * 100;
}

// Stress Stability [0–100] — lower drift from baseline HR ⇒ higher stability
export function computeStressStability(baselineHr: number, stressHr: number): number {
  const drift = Math.abs(stressHr - baselineHr) / Math.max(1, baselineHr);
  return Math.max(0, 1 - drift) * 100;
}

// Reaction Consistency [0–100] — lower SD of RT ⇒ higher consistency.
// Maps SD via Consistency = 100 - min(100, SD/MAX_SD * 100), MAX_SD = 4000ms.
export function computeReactionConsistency(reactionTimesMs: number[]): number {
  const valid = reactionTimesMs.filter((rt) => rt > 100 && rt < 30_000);
  if (valid.length < 2) return 0;
  const mean = valid.reduce((a, b) => a + b, 0) / valid.length;
  const variance =
    valid.reduce((a, b) => a + (b - mean) ** 2, 0) / valid.length;
  const sd = Math.sqrt(variance);
  const MAX_SD = 4000;
  const penalty = Math.min(100, (sd / MAX_SD) * 100);
  return Math.max(0, 100 - penalty);
}

export type BeqaBreakdown = {
  accuracy: number;
  stability: number;
  reaction: number;
  beqa: number;
  reactionSdMs: number;
  interpretation: string;
};

export function calculateBeqaScore(params: {
  correctAnswers: number;
  totalQuestions: number;
  baselineHr: number;
  stressHr: number;
  reactionTimesMs: number[];
}): BeqaBreakdown {
  const accuracy = computeAccuracy(params.correctAnswers, params.totalQuestions);
  const stability = computeStressStability(params.baselineHr, params.stressHr);
  const reaction = computeReactionConsistency(params.reactionTimesMs);
  const beqa = accuracy * 0.4 + stability * 0.3 + reaction * 0.3;

  const valid = params.reactionTimesMs.filter((rt) => rt > 100 && rt < 30_000);
  let sd = 0;
  if (valid.length >= 2) {
    const mean = valid.reduce((a, b) => a + b, 0) / valid.length;
    sd = Math.sqrt(valid.reduce((a, b) => a + (b - mean) ** 2, 0) / valid.length);
  }

  return {
    accuracy: Math.round(accuracy * 10) / 10,
    stability: Math.round(stability * 10) / 10,
    reaction: Math.round(reaction * 10) / 10,
    beqa: Math.round(beqa * 10) / 10,
    reactionSdMs: Math.round(sd),
    interpretation: interpretBeqa(beqa),
  };
}

// Interpretation Layer per spec §4.3
export function interpretBeqa(score: number): string {
  if (score >= 85) return "יציב מאוד תחת לחץ";
  if (score >= 70) return "יציבות טובה, עם רגעי לחץ נקודתיים";
  if (score >= 50) return "חוסר יציבות מתון תחת לחץ";
  return "חוסר יציבות משמעותי בתנאי סטרס";
}
