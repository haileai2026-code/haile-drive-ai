// Marvad simulator: question banks + scoring.
// Shared by the route (rendering / local result screen) and the server
// function that grades and stores the session (beqa-submit.functions.ts).
// The server recomputes every sub-score from raw picks/measurements; the
// client never submits a score.

// ===== MMPI Questions (HE + AM) =====
export const MMPI_QUESTIONS: Array<{
  id: string;
  he: string;
  am: string;
  options: Array<{ he: string; am: string; score: number }>;
  isLieDetector?: boolean;
}> = [
  {
    id: "q1",
    he: "אני מרגיש שאנשים מבינים אותי היטב.",
    am: "ሰዎች በሚገባ እንደሚረዱኝ ይሰማኛል።",
    options: [
      { he: "תמיד", am: "ሁልጊዜ", score: 4 },
      { he: "לעיתים קרובות", am: "ብዙ ጊዜ", score: 3 },
      { he: "לפעמים", am: "አንዳንዴ", score: 2 },
      { he: "לעולם לא", am: "በፍፁም", score: 1 },
    ],
  },
  {
    id: "q2",
    he: "מעולם לא שיקרתי, אפילו לא במשהו קטן.",
    am: "በትንሽ ነገር እንኳ ዋሽቼ አላውቅም።",
    isLieDetector: true,
    options: [
      { he: "נכון לחלוטין", am: "ሙሉ በሙሉ እውነት", score: 0 },
      { he: "נכון בדרך כלל", am: "በአብዛኛው እውነት", score: 2 },
      { he: "לא נכון", am: "እውነት አይደለም", score: 4 },
    ],
  },
  {
    id: "q3",
    he: "אני מסוגל להתמודד עם לחץ ביום-יום.",
    am: "የእለት ተእለት ጫናን መቋቋም እችላለሁ።",
    options: [
      { he: "תמיד", am: "ሁልጊዜ", score: 4 },
      { he: "לרוב", am: "በአብዛኛው", score: 3 },
      { he: "מדי פעם", am: "አልፎ አልፎ", score: 2 },
      { he: "כמעט אף פעם", am: "በፍፁም ማለት ይቻላል", score: 1 },
    ],
  },
  {
    id: "q4",
    he: "אני ישן טוב בלילה.",
    am: "ሌሊት በደንብ እተኛለሁ።",
    options: [
      { he: "תמיד", am: "ሁልጊዜ", score: 4 },
      { he: "לרוב", am: "በአብዛኛው", score: 3 },
      { he: "לפעמים", am: "አንዳንዴ", score: 2 },
      { he: "כמעט אף פעם", am: "በፍፁም ማለት ይቻላል", score: 1 },
    ],
  },
  {
    id: "q5",
    he: "אני אף פעם לא כועס על אף אחד.",
    am: "በማንም ላይ ተናድጄ አላውቅም።",
    isLieDetector: true,
    options: [
      { he: "נכון לחלוטין", am: "ሙሉ በሙሉ እውነት", score: 0 },
      { he: "נכון לרוב", am: "በአብዛኛው እውነት", score: 2 },
      { he: "לא נכון", am: "እውነት አይደለም", score: 4 },
    ],
  },
];

// ===== Interview =====
export const INTERVIEW = [
  {
    id: "i1",
    q: "ספר לי על מצב לחץ שחווית לאחרונה. איך התמודדת?",
    opts: [
      { text: "פעלתי באימפולסיביות וניסיתי לסיים מהר", trait: "impulsivity", w: -10 },
      { text: "עצרתי, נשמתי עמוק וחשבתי לפני שפעלתי", trait: "selfControl", w: +15 },
      { text: "פניתי לעזרה ושיתפתי מישהו קרוב", trait: "social", w: +10 },
    ],
  },
  {
    id: "i2",
    q: "מה אתה מרגיש כשנהג אחר חותך אותך בכביש?",
    opts: [
      { text: "כועס מאוד ורוצה להגיב", trait: "aggression", w: -15 },
      { text: "מתעצבן רגע אבל ממשיך הלאה", trait: "balanced", w: +10 },
      { text: "לא אכפת לי, אני נשאר רגוע", trait: "calm", w: +15 },
    ],
  },
  {
    id: "i3",
    q: "מה הסיבה האמיתית שלך לרצות להיות נהג?",
    opts: [
      { text: "כסף ופרנסה בלבד", trait: "extrinsic", w: 0 },
      { text: "אהבה לכביש ועצמאות", trait: "intrinsic", w: +15 },
      { text: "אין לי ברירה אחרת", trait: "noChoice", w: -10 },
    ],
  },
  {
    id: "i4",
    q: "איך אתה מגיב לביקורת מהמנהל שלך?",
    opts: [
      { text: "מתגונן ומסביר את עצמי", trait: "defensive", w: -5 },
      { text: "מקשיב ומנסה להשתפר", trait: "growth", w: +15 },
      { text: "מקבל אבל בפנים נפגע", trait: "internalize", w: +5 },
    ],
  },
];

export type CptRaw = { rtMean: number; rtSd: number; omissions: number; commissions: number };
export type CptResult = CptRaw & { score: number };
export type AtavtResult = { score: number; trials: number[] };

export const MMPI_MAX = MMPI_QUESTIONS.length * 4;

export function cptScore(r: Pick<CptRaw, "rtMean" | "omissions" | "commissions">): number {
  let score = 100;
  score -= r.omissions * 10;
  score -= r.commissions * 8;
  if (r.rtMean > 600) score -= 10;
  return Math.max(0, Math.min(100, score));
}

export function atavtScore(trials: number[]): number {
  const arr = trials.length ? trials : [0];
  return Math.round(arr.reduce((a, b) => a + b, 0) / arr.length);
}

export function mmpiFromPicks(picks: number[]): { score: number; lieFlag: boolean } {
  if (picks.length !== MMPI_QUESTIONS.length) throw new Error("incomplete MMPI answers");
  let score = 0;
  let lie = 0;
  picks.forEach((idx, i) => {
    const q = MMPI_QUESTIONS[i];
    const opt = q.options[idx];
    if (!opt) throw new Error(`invalid MMPI option at ${q.id}`);
    score += opt.score;
    if (q.isLieDetector && opt.score === 0) lie += 1;
  });
  return { score, lieFlag: lie >= 2 };
}

export function interviewFromPicks(picks: number[]): { score: number; notes: string[] } {
  if (picks.length !== INTERVIEW.length) throw new Error("incomplete interview answers");
  let score = 0;
  const notes: string[] = [];
  picks.forEach((idx, i) => {
    const q = INTERVIEW[i];
    const opt = q.opts[idx];
    if (!opt) throw new Error(`invalid interview option at ${q.id}`);
    score += opt.w;
    notes.push(`${q.id}: ${opt.trait} (${opt.text})`);
  });
  return { score, notes };
}

export function computeMarvad(
  cpt: CptResult | null,
  atavt: AtavtResult | null,
  interview: number,
  mmpi: number,
  lieFlag: boolean,
): number {
  const mmpiPct = Math.min(100, (mmpi / MMPI_MAX) * 100);
  const interviewPct = Math.min(100, Math.max(0, 50 + interview));
  const cptPct = cpt?.score ?? 0;
  const atavtPct = atavt?.score ?? 0;
  const errors = (cpt?.omissions ?? 0) + (cpt?.commissions ?? 0);
  let total = mmpiPct * 0.2 + interviewPct * 0.4 + cptPct * 0.2 + atavtPct * 0.1 - errors * 2;
  if (lieFlag) total -= 10;
  return Math.max(0, Math.min(100, Math.round(total)));
}
