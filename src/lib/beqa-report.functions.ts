import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const QUESTION_LABELS: Record<string, string> = {
  q1: "מוטיבציה לנהיגה",
  q2: "שליטה עצמית",
  q3: "אחריות בטיחותית",
  q4: "הכרת חוק שעות נהיגה",
  q5: "חוסן לאחר כישלון",
  q6: "תמיכה משפחתית",
  q7: "תקשורת — חסם שפה",
  q8: "מחויבות ללמידה",
  q9: "ציפיות שכר",
  q10: "הגדרה עצמית",
  qe1: "חוסן (קהילה)",
  qe2: "ערכים קהילתיים",
  qe3: "אומץ התמודדות",
  qp: "תרחיש לחץ",
};

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export const generateBeqaReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { sessionId: string }) =>
    z.object({ sessionId: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data }) => {
    const { data: session, error } = await supabaseAdmin
      .from("beqa_diagnostic_sessions")
      .select("*")
      .eq("id", data.sessionId)
      .maybeSingle();

    if (error || !session) {
      throw new Error("Session not found");
    }

    let profile: { full_name: string | null; email: string | null } | null = null;
    if (session.student_id) {
      const { data: p } = await supabaseAdmin
        .from("profiles")
        .select("full_name, email")
        .eq("id", session.student_id)
        .maybeSingle();
      profile = p ?? null;
    }

    const communityLabel =
      session.community_type === "ethiopian"
        ? "אתיופי"
        : session.community_type === "russian"
          ? "רוסי"
          : session.community_type === "kuki"
            ? "קוקי"
            : session.community_type || "—";

    const recommendation = (session.recommendation as string) || "B";
    const recText =
      recommendation === "A"
        ? "✓ מומלץ מאוד"
        : recommendation === "C"
          ? "✗ לא מומלץ כרגע"
          : "⚠ ראיון נוסף מומלץ";

    const answers = (session.answers as Record<string, number>) || {};
    const answerRows = Object.entries(answers)
      .map(([k, v]) => {
        const score = Number(v) || 0;
        const cls = score >= 4 ? "good" : score >= 3 ? "mid" : "bad";
        const rating =
          score >= 4 ? "מצוין" : score >= 3 ? "טוב" : score >= 2 ? "בינוני" : "נמוך";
        return `<tr><td>${escapeHtml(QUESTION_LABELS[k] || k)}</td><td class="${cls}">${score}/4</td><td class="${cls}">${rating}</td></tr>`;
      })
      .join("");

    const reportId = String(session.id).substring(0, 8).toUpperCase();
    const psych = Number(session.psychological_score || 0);
    const accuracy = Number(session.accuracy_score || 0);
    const finalScore = Number(session.final_beqa_score || 0);

    const html = `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
<meta charset="UTF-8">
<title>Haile Drive AI — דוח ${escapeHtml(reportId)}</title>
<style>
  body { font-family: Arial, sans-serif; direction: rtl; color: #0D1B2A; margin: 40px; }
  .header { background: #0D1B2A; color: #C9A84C; padding: 20px; text-align: center; }
  .title { font-size: 28px; font-weight: bold; }
  .subtitle { font-size: 14px; color: #ccc; margin-top: 6px; }
  .confidential { text-align: center; font-size: 11px; color: #aaa; margin: 10px 0; }
  .info-table { width: 100%; border-collapse: collapse; margin: 20px 0; }
  .info-table td { padding: 8px 12px; font-size: 12px; border-bottom: 1px solid #eee; }
  .info-table td:nth-child(odd) { font-weight: bold; color: #0D1B2A; width: 140px; }
  .section-title { font-size: 18px; font-weight: bold; color: #0D1B2A; border-bottom: 2px solid #C9A84C; padding-bottom: 6px; margin: 24px 0 12px; }
  .score-box { background: #0D1B2A; color: #C9A84C; text-align: center; padding: 20px; border-radius: 8px; display: inline-block; min-width: 140px; vertical-align: middle; }
  .score-num { font-size: 48px; font-weight: bold; }
  .score-label { font-size: 12px; color: #ccc; }
  .rec-box { display: inline-block; padding: 10px 24px; border-radius: 6px; font-weight: bold; font-size: 16px; margin-right: 20px; }
  .rec-B { background: #FFF9E6; color: #C9A84C; border: 1px solid #C9A84C; }
  .rec-A { background: #E8F5E9; color: #27AE60; border: 1px solid #27AE60; }
  .rec-C { background: #FFEBEE; color: #ef4444; border: 1px solid #ef4444; }
  .metrics table { width: 100%; border-collapse: collapse; }
  .metrics td { padding: 8px 12px; border-bottom: 1px solid #f0f0f0; font-size: 12px; }
  .metrics tr:nth-child(even) { background: #F4F6FA; }
  .good { color: #27AE60; font-weight: bold; }
  .mid  { color: #C9A84C; font-weight: bold; }
  .bad  { color: #ef4444; font-weight: bold; }
  .strength { color: #27AE60; margin: 4px 0; font-size: 13px; }
  .improve  { color: #C9A84C; margin: 4px 0; font-size: 13px; }
  .footer { margin-top: 40px; border-top: 1px solid #eee; padding-top: 10px; text-align: center; font-size: 10px; color: #aaa; }
  @media print { body { margin: 20px; } }
</style>
</head>
<body>

<div class="header">
  <div class="title">Haile Drive AI</div>
  <div class="subtitle">תיק אבחון פסיכולוגי-תעסוקתי | BEQA Report</div>
</div>

<p class="confidential">סודי — לשימוש מקצועי בלבד</p>

<table class="info-table">
  <tr><td>שם המועמד:</td><td>${escapeHtml(profile?.full_name || "לא ידוע")}</td><td>תאריך:</td><td>${escapeHtml(new Date(session.created_at).toLocaleDateString("he-IL"))}</td></tr>
  <tr><td>קהילה:</td><td>${escapeHtml(communityLabel)}</td><td>מספר דוח:</td><td>${escapeHtml(reportId)}</td></tr>
  <tr><td>סוג אבחון:</td><td>${escapeHtml(session.assessment_type || "פסיכולוגי")}</td><td>מייל:</td><td>${escapeHtml(profile?.email || "")}</td></tr>
</table>

<div class="section-title">סיכום מנהלים</div>
<div style="margin-bottom:20px;">
  <div class="score-box">
    <div class="score-num">${finalScore.toFixed(0)}</div>
    <div class="score-label">ציון BEQA</div>
  </div>
  <div class="rec-box rec-${escapeHtml(recommendation)}">${recText}</div>
  <div style="margin-top:10px; font-size:13px; color:#555;">
    ציון פסיכולוגי: <strong>${psych.toFixed(2)}/4.0</strong> &nbsp;|&nbsp;
    ציון דיוק: <strong>${accuracy.toFixed(1)}%</strong>
  </div>
</div>

${
  answerRows
    ? `<div class="section-title">ניתוח תשובות</div>
<div class="metrics">
<table>
  <tr style="background:#0D1B2A; color:#C9A84C; font-weight:bold;">
    <td>מדד</td><td>ציון</td><td>הערכה</td>
  </tr>
  ${answerRows}
</table>
</div>`
    : ""
}

<div class="section-title">המלצות מקצועיות</div>
<p class="strength">✔ מוטיבציה גבוהה ואמיתית למקצוע הנהיגה</p>
<p class="strength">✔ שליטה עצמית מוכחת תחת לחץ</p>
<p class="strength">✔ אחריות בטיחותית גבוהה</p>
<p class="strength">✔ מחויבות ללמידה ותהליך ארוך טווח</p>
${psych < 4 ? '<p class="improve">◆ מומלץ ראיון נוסף לאחר 30 יום</p>' : ""}
<p class="improve">◆ השלמת מבחן תיאוריה לפני המרב"ד הרשמי</p>

<div class="footer">
  הדוח הופק על ידי Haile Drive AI | haileai.app | מספר דוח: ${escapeHtml(reportId)} | ${escapeHtml(new Date().toLocaleDateString("he-IL"))}
</div>

<script>
  window.addEventListener('load', () => { setTimeout(() => window.print(), 500); });
</script>

</body>
</html>`;

    return { html };
  });
