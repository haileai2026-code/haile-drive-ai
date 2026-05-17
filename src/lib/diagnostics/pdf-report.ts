import jsPDF from "jspdf";
import html2canvas from "html2canvas";

type Answer = {
  qId: string;
  score: number;
  rtMs: number;
  bpmAtAnswer: number | null;
  emotionAtAnswer: {
    anxiety: number; focus: number; confidence: number; confusion: number;
  } | null;
};

type Session = {
  id: string;
  student_id: string;
  start_time: string;
  community_type: string | null;
  psychological_score: number | null;
  baseline_hr: number | null;
  stress_hr: number | null;
  accuracy_score: number | null;
  final_beqa_score: number | null;
  recommendation: string | null;
  answers: Answer[] | null;
  metadata: Record<string, unknown> | null;
};

type Profile = { id: string; full_name: string | null; email: string | null } | undefined;

const COMMUNITY_LABEL: Record<string, string> = {
  ethiopian: "אתיופי",
  russian: "רוסי",
  kuki: "קוקי / בני מנשה",
};

function recInfo(letter: string | null, beqa: number | null) {
  const s = beqa ?? 0;
  if (letter === "A" || s >= 75)
    return { emoji: "🟢", label: "מומלץ מאוד להמשך תהליך", color: "#10b981" };
  if (letter === "B" || s >= 55)
    return { emoji: "🟡", label: "מומלץ ראיון נוסף", color: "#f59e0b" };
  return { emoji: "🔴", label: "לא מומלץ כרגע", color: "#ef4444" };
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString("he-IL", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function bpmSvg(series: { t: number; bpm: number }[], width = 700, height = 220) {
  if (!series.length) return `<div style="color:#888">אין נתוני דופק</div>`;
  const pad = 30;
  const xs = series.map((p) => p.t);
  const ys = series.map((p) => p.bpm);
  const xMin = Math.min(...xs), xMax = Math.max(...xs);
  const yMin = Math.min(...ys) - 5, yMax = Math.max(...ys) + 5;
  const px = (x: number) => pad + ((x - xMin) / (xMax - xMin || 1)) * (width - pad * 2);
  const py = (y: number) => height - pad - ((y - yMin) / (yMax - yMin || 1)) * (height - pad * 2);
  const d = series.map((p, i) => `${i === 0 ? "M" : "L"}${px(p.t).toFixed(1)},${py(p.bpm).toFixed(1)}`).join(" ");
  return `<svg width="${width}" height="${height}" style="background:#fff;border:1px solid #e5e7eb;border-radius:8px">
    <text x="${pad}" y="20" font-size="11" fill="#6b7280">BPM</text>
    <text x="${width - pad - 40}" y="${height - 8}" font-size="11" fill="#6b7280">זמן (שניות)</text>
    <path d="${d}" fill="none" stroke="#ef4444" stroke-width="2"/>
  </svg>`;
}

function barsSvg(items: { label: string; value: number }[], width = 700, height = 220) {
  const pad = 40;
  const bw = (width - pad * 2) / items.length - 12;
  return `<svg width="${width}" height="${height}" style="background:#fff;border:1px solid #e5e7eb;border-radius:8px">
    ${items.map((it, i) => {
      const h = (it.value / 100) * (height - pad * 2);
      const x = pad + i * (bw + 12);
      const y = height - pad - h;
      return `<g>
        <rect x="${x}" y="${y}" width="${bw}" height="${h}" fill="#f59e0b" rx="4"/>
        <text x="${x + bw / 2}" y="${height - pad + 14}" font-size="11" fill="#374151" text-anchor="middle">${it.label}</text>
        <text x="${x + bw / 2}" y="${y - 4}" font-size="11" fill="#111827" text-anchor="middle">${Math.round(it.value)}</text>
      </g>`;
    }).join("")}
  </svg>`;
}

function page(html: string) {
  return `<div class="pdf-page" style="
    width:794px;min-height:1123px;padding:48px;box-sizing:border-box;
    background:#fff;color:#0f172a;font-family:'Segoe UI','Arial',sans-serif;
    direction:rtl;text-align:right;page-break-after:always;
  ">${html}</div>`;
}

function buildHtml(session: Session, profile: Profile): string {
  const meta = (session.metadata ?? {}) as {
    biometric_score?: number;
    face_score?: number;
    stability?: number;
    bpm_series?: { t: number; bpm: number; hrv: number }[];
    emotion_series?: { t: number; anxiety: number; focus: number; confidence: number; confusion: number }[];
    insights?: string[];
  };
  const name = profile?.full_name || profile?.email || session.student_id.slice(0, 8);
  const date = fmtDate(session.start_time);
  const rec = recInfo(session.recommendation, session.final_beqa_score);
  const community = COMMUNITY_LABEL[session.community_type ?? ""] ?? session.community_type ?? "—";
  const answers = session.answers ?? [];
  const beqa = Math.round(session.final_beqa_score ?? 0);

  // biometric
  const bpmRaw = meta.bpm_series ?? [];
  const bpmChart = bpmRaw.map((p) => ({ t: Math.round(p.t / 1000), bpm: p.bpm }));
  const avgHrv = bpmRaw.length
    ? Math.round(bpmRaw.reduce((a, b) => a + b.hrv, 0) / bpmRaw.length)
    : 0;

  // emotion averages
  const emos = meta.emotion_series ?? [];
  const avg = (k: "anxiety" | "focus" | "confidence" | "confusion") =>
    emos.length ? Math.round((emos.reduce((a, b) => a + b[k], 0) / emos.length) * 100) : 0;

  // hard questions (high anxiety)
  const hardQs = answers
    .map((a, i) => ({ idx: i + 1, anxiety: a.emotionAtAnswer?.anxiety ?? 0, bpm: a.bpmAtAnswer ?? 0 }))
    .filter((q) => q.anxiety > 0.5)
    .sort((a, b) => b.anxiety - a.anxiety)
    .slice(0, 3);
  const hardLabel = hardQs.length
    ? hardQs.map((q) => `שאלה ${q.idx}`).join(", ")
    : "אין רגעי שיא משמעותיים";

  // psych dimension proxy buckets from answers (5 fixed bars)
  const total = Math.max(1, answers.length);
  const score = (from: number, to: number) => {
    const slice = answers.slice(from, to);
    if (!slice.length) return Math.round(((session.psychological_score ?? 0)));
    return Math.round((slice.reduce((a, b) => a + b.score, 0) / (slice.length * 4)) * 100);
  };
  const psychBars = [
    { label: "מוטיבציה", value: score(0, 2) },
    { label: "שליטה עצמית", value: score(2, 4) },
    { label: "בטיחות", value: score(4, 6) },
    { label: "תקשורת", value: score(6, 8) },
    { label: "יציבות", value: score(8, total) },
  ];

  // recommendations text
  const strengths: string[] = [];
  const weaknesses: string[] = [];
  if (avg("focus") >= 70) strengths.push("ריכוז גבוה לאורך הבדיקה — נכס לתפקיד נהג.");
  if (avg("confidence") >= 60) strengths.push("רמת ביטחון יציבה במתן תשובות.");
  if ((session.psychological_score ?? 0) >= 70) strengths.push("ציון פסיכולוגי גבוה במדדי בטיחות והחלטה.");
  if (avg("anxiety") >= 50) weaknesses.push("רמת חרדה כללית גבוהה — מומלץ תרגול נשימה ושיחת תמיכה.");
  if ((meta.stability ?? 100) < 70) weaknesses.push("עלייה משמעותית בדופק תחת לחץ — תרגול סימולציות.");
  if ((session.psychological_score ?? 0) < 55) weaknesses.push("ציון פסיכולוגי נמוך — שיחה מעמיקה לפני המשך תהליך.");
  if (!strengths.length) strengths.push("ביצועים יציבים — אין דגלים אדומים.");
  if (!weaknesses.length) weaknesses.push("לא זוהו תחומים הדורשים חיזוק מיידי.");

  const insights = meta.insights ?? [];

  // ---------- PAGE 1 — Cover ----------
  const p1 = `
    <div style="height:100%;display:flex;flex-direction:column;justify-content:space-between;min-height:1000px">
      <div>
        <div style="display:flex;align-items:center;justify-content:space-between">
          <div style="font-size:22px;font-weight:800;color:#b45309">⚡ Haile Drive AI</div>
          <div style="font-size:11px;color:#64748b">${date}</div>
        </div>
        <hr style="margin:18px 0;border:none;border-top:2px solid #f59e0b"/>
      </div>
      <div style="text-align:center;padding:40px 0">
        <div style="font-size:36px;font-weight:900;margin-bottom:16px">תיק אבחון פסיכולוגי-תעסוקתי</div>
        <div style="font-size:18px;color:#475569;margin-bottom:40px">Professional Psych-Vocational Assessment Report</div>
        <div style="display:inline-block;padding:24px 32px;border:2px solid #f59e0b;border-radius:12px;background:#fffbeb">
          <div style="font-size:14px;color:#92400e;margin-bottom:8px">שם המועמד</div>
          <div style="font-size:28px;font-weight:800;margin-bottom:16px">${escapeHtml(name)}</div>
          <div style="font-size:13px;color:#92400e">תאריך אבחון: ${date}</div>
          <div style="font-size:13px;color:#92400e">מספר דוח: ${session.id}</div>
        </div>
      </div>
      <div style="text-align:center;padding:18px;background:#fef2f2;border:1px solid #fecaca;border-radius:8px;color:#991b1b;font-weight:700">
        🔒 סודי — לשימוש מקצועי בלבד
      </div>
    </div>`;

  // ---------- PAGE 2 — Executive summary ----------
  const p2 = `
    <h2 style="font-size:24px;font-weight:800;border-bottom:2px solid #f59e0b;padding-bottom:8px">סיכום מנהלים</h2>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:24px">
      <div style="padding:24px;border-radius:12px;background:#0f172a;color:#fff;text-align:center">
        <div style="font-size:13px;opacity:.8">ציון BEQA סופי</div>
        <div style="font-size:64px;font-weight:900;color:#fbbf24;margin:8px 0">${beqa}<span style="font-size:24px;opacity:.7">/100</span></div>
      </div>
      <div style="padding:24px;border-radius:12px;border:2px solid ${rec.color};text-align:center;background:#fff">
        <div style="font-size:13px;color:#64748b">המלצה</div>
        <div style="font-size:48px;margin:8px 0">${rec.emoji}</div>
        <div style="font-size:18px;font-weight:700;color:${rec.color}">${rec.label}</div>
      </div>
    </div>
    <table style="width:100%;border-collapse:collapse;margin-top:24px;font-size:14px">
      <tbody>
        ${row("שם המועמד", escapeHtml(name))}
        ${row("קהילה", community)}
        ${row("תאריך אבחון", date)}
        ${row("מספר דוח", session.id)}
        ${row("שם המאבחן", "Haile Drive AI System")}
        ${row("ציון פסיכולוגי", `${Math.round(session.psychological_score ?? 0)}/100`)}
        ${row("ציון ביומטרי", `${Math.round(meta.biometric_score ?? 0)}/100`)}
        ${row("ציון ניתוח פנים", `${Math.round(meta.face_score ?? 0)}/100`)}
      </tbody>
    </table>`;

  // ---------- PAGE 3 — Biometric ----------
  const p3 = `
    <h2 style="font-size:24px;font-weight:800;border-bottom:2px solid #ef4444;padding-bottom:8px">מדדים ביומטריים</h2>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-top:20px">
      ${tile("דופק בסיס", `${session.baseline_hr ?? "—"} BPM`, "#10b981")}
      ${tile("דופק שיא (סטרס)", `${session.stress_hr ?? "—"} BPM`, "#ef4444")}
      ${tile("HRV ממוצע", `${avgHrv} ms`, "#3b82f6")}
    </div>
    <div style="margin-top:24px">
      <div style="font-weight:700;margin-bottom:8px">גרף דופק לאורך המבחן</div>
      ${bpmSvg(bpmChart)}
    </div>
    <div style="margin-top:20px;padding:14px;background:#f8fafc;border-right:4px solid #ef4444;border-radius:6px">
      <div style="font-weight:700;margin-bottom:4px">ניתוח</div>
      <div style="font-size:13px;color:#334155">
        ${hardQs.length
          ? `המועמד הראה עלייה משמעותית בדופק ובחרדה ב-${hardLabel}.`
          : "הדופק נשאר יציב לאורך כל המבחן — אין רגעי לחץ חריגים."}
      </div>
    </div>`;

  // ---------- PAGE 4 — Psychological ----------
  const rows = answers.map((a, i) => `
    <tr style="border-bottom:1px solid #e5e7eb">
      <td style="padding:6px 8px;font-weight:600">${i + 1}</td>
      <td style="padding:6px 8px;font-family:monospace;color:#64748b">${a.qId}</td>
      <td style="padding:6px 8px">${a.score}/4</td>
      <td style="padding:6px 8px">${(a.rtMs / 1000).toFixed(1)}s</td>
      <td style="padding:6px 8px">${Math.round((a.emotionAtAnswer?.anxiety ?? 0) * 100)}%</td>
      <td style="padding:6px 8px">${Math.round((a.emotionAtAnswer?.focus ?? 0) * 100)}%</td>
    </tr>`).join("");
  const p4 = `
    <h2 style="font-size:24px;font-weight:800;border-bottom:2px solid #3b82f6;padding-bottom:8px">ניתוח פסיכולוגי</h2>
    <table style="width:100%;border-collapse:collapse;margin-top:16px;font-size:12px">
      <thead style="background:#f1f5f9">
        <tr>
          <th style="padding:8px;text-align:right">#</th>
          <th style="padding:8px;text-align:right">מזהה שאלה</th>
          <th style="padding:8px;text-align:right">ניקוד</th>
          <th style="padding:8px;text-align:right">זמן תגובה</th>
          <th style="padding:8px;text-align:right">חרדה</th>
          <th style="padding:8px;text-align:right">ריכוז</th>
        </tr>
      </thead>
      <tbody>${rows || `<tr><td colspan="6" style="padding:12px;color:#64748b">אין תשובות מתועדות</td></tr>`}</tbody>
    </table>
    <div style="margin-top:24px">
      <div style="font-weight:700;margin-bottom:8px">פרופיל ממדים פסיכולוגיים</div>
      ${barsSvg(psychBars)}
    </div>`;

  // ---------- PAGE 5 — Face analysis ----------
  const peakAnx = answers
    .map((a, i) => ({ i: i + 1, v: a.emotionAtAnswer?.anxiety ?? 0 }))
    .sort((a, b) => b.v - a.v)[0];
  const p5 = `
    <h2 style="font-size:24px;font-weight:800;border-bottom:2px solid #8b5cf6;padding-bottom:8px">ניתוח הבעות פנים</h2>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-top:20px">
      ${tile("חרדה ממוצעת", `${avg("anxiety")}%`, "#ef4444")}
      ${tile("ריכוז ממוצע", `${avg("focus")}%`, "#10b981")}
      ${tile("ביטחון ממוצע", `${avg("confidence")}%`, "#3b82f6")}
    </div>
    <div style="margin-top:24px">
      <div style="font-weight:700;margin-bottom:8px">פילוח רגשי</div>
      ${barsSvg([
        { label: "חרדה", value: avg("anxiety") },
        { label: "ריכוז", value: avg("focus") },
        { label: "ביטחון", value: avg("confidence") },
        { label: "בלבול", value: avg("confusion") },
      ])}
    </div>
    <div style="margin-top:20px;padding:14px;background:#faf5ff;border-right:4px solid #8b5cf6;border-radius:6px">
      <div style="font-weight:700;margin-bottom:6px">רגעי שיא</div>
      <div style="font-size:13px;color:#334155">
        ${peakAnx && peakAnx.v > 0.4
          ? `שאלה ${peakAnx.i} גרמה לרמת חרדה הגבוהה ביותר (${Math.round(peakAnx.v * 100)}%).`
          : "לא זוהו רגעי שיא חריגים בחרדה."}
      </div>
    </div>`;

  // ---------- PAGE 6 — Recommendations ----------
  const p6 = `
    <h2 style="font-size:24px;font-weight:800;border-bottom:2px solid #10b981;padding-bottom:8px">המלצות מקצועיות</h2>
    <div style="margin-top:20px">
      <div style="font-size:16px;font-weight:700;color:#059669;margin-bottom:8px">✅ חוזקות שזוהו</div>
      <ul style="padding-right:20px;line-height:1.8;font-size:13px">
        ${strengths.map((s) => `<li>${escapeHtml(s)}</li>`).join("")}
      </ul>
    </div>
    <div style="margin-top:18px">
      <div style="font-size:16px;font-weight:700;color:#d97706;margin-bottom:8px">⚠️ תחומים לחיזוק</div>
      <ul style="padding-right:20px;line-height:1.8;font-size:13px">
        ${weaknesses.map((s) => `<li>${escapeHtml(s)}</li>`).join("")}
      </ul>
    </div>
    <div style="margin-top:18px">
      <div style="font-size:16px;font-weight:700;color:#2563eb;margin-bottom:8px">📋 המלצות לתהליך ההכשרה</div>
      <ul style="padding-right:20px;line-height:1.8;font-size:13px">
        ${insights.length
          ? insights.map((s) => `<li>${escapeHtml(s)}</li>`).join("")
          : "<li>המשך תהליך הכשרה רגיל בהתאם לסטנדרט.</li>"}
        <li>סקירה חוזרת לאחר 30 יום של תרגול.</li>
        <li>תיעוד מתמשך של ביצועים בסימולציות.</li>
      </ul>
    </div>
    <div style="position:absolute;bottom:48px;right:48px;left:48px;text-align:center;padding-top:16px;border-top:1px solid #e5e7eb;color:#64748b;font-size:11px">
      הדוח הופק על ידי Haile Drive AI | haileai.app | מספר דוח: ${session.id}
    </div>`;

  return [p1, p2, p3, p4, p5, p6].map(page).join("");
}

function row(k: string, v: string) {
  return `<tr style="border-bottom:1px solid #e5e7eb">
    <td style="padding:10px 8px;font-weight:600;color:#475569;width:40%">${k}</td>
    <td style="padding:10px 8px">${v}</td>
  </tr>`;
}

function tile(label: string, value: string, color: string) {
  return `<div style="padding:16px;border:1px solid #e5e7eb;border-radius:10px;background:#fff">
    <div style="font-size:12px;color:#64748b">${label}</div>
    <div style="font-size:24px;font-weight:800;color:${color};margin-top:4px">${value}</div>
  </div>`;
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function generateDiagnosticPdf(session: Session, profile: Profile) {
  const container = document.createElement("div");
  container.style.cssText = "position:fixed;left:-99999px;top:0;background:#fff";
  container.innerHTML = buildHtml(session, profile);
  document.body.appendChild(container);

  try {
    const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
    const pageWmm = 210, pageHmm = 297;
    const pages = Array.from(container.querySelectorAll<HTMLElement>(".pdf-page"));

    for (let i = 0; i < pages.length; i++) {
      const canvas = await html2canvas(pages[i], {
        scale: 2,
        backgroundColor: "#ffffff",
        useCORS: true,
        logging: false,
      });
      const img = canvas.toDataURL("image/jpeg", 0.92);
      if (i > 0) pdf.addPage();
      pdf.addImage(img, "JPEG", 0, 0, pageWmm, pageHmm);
    }

    const name = (profile?.full_name || profile?.email || "candidate")
      .replace(/[^\w\u0590-\u05FFa-zA-Z0-9]+/g, "_");
    const dateStr = new Date(session.start_time).toISOString().slice(0, 10);
    pdf.save(`BEQA_${name}_${dateStr}.pdf`);
  } finally {
    document.body.removeChild(container);
  }
}
