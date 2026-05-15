// 5 שאלות תיאוריה קשות למבחן תחת סטרס

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
];

const TIME_PER_QUESTION_MS = 20_000; // 20 שניות לשאלה

export const STRESS_TEST_CONFIG = {
  timePerQuestionMs: TIME_PER_QUESTION_MS,
  totalTimeMs: TIME_PER_QUESTION_MS * STRESS_QUESTIONS.length,
};

// נוסחת BEQA: (Accuracy * 0.6) + (Stability_Score * 0.4)
// Stability_Score: ככל שהדופק תחת סטרס קרוב יותר ל-baseline, היציבות גבוהה יותר.
// stability = max(0, 1 - |stress_hr - baseline_hr| / baseline_hr)
export function calculateBeqaScore(params: {
  correctAnswers: number;
  totalQuestions: number;
  baselineHr: number;
  stressHr: number;
}): {
  accuracy: number;
  stability: number;
  beqa: number;
} {
  const accuracy = params.correctAnswers / Math.max(1, params.totalQuestions);
  const drift = Math.abs(params.stressHr - params.baselineHr) / Math.max(1, params.baselineHr);
  const stability = Math.max(0, 1 - drift);
  const beqa = accuracy * 0.6 + stability * 0.4;
  return {
    accuracy: Math.round(accuracy * 1000) / 10, // %
    stability: Math.round(stability * 1000) / 10, // %
    beqa: Math.round(beqa * 1000) / 10, // %
  };
}
