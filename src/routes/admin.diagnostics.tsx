import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AdminShell, AdminLoading } from "@/components/AdminShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";

type DiagnosticSession = {
  id: string;
  student_id: string | null;
  created_at: string;
  final_beqa_score: number | null;
  accuracy_score: number | null;
  recommendation: string | null;
  psychological_score?: number | null;
  community_type?: string | null;
  answers?: Record<string, number> | null;
  profiles: { full_name: string | null; email: string | null } | null;
};

export const Route = createFileRoute("/admin/diagnostics")({
  head: () => ({ meta: [{ title: "דוחות אבחון — Owner" }] }),
  component: AdminDiagnosticsPage,
});

function generateBeqaReport(session: any) {
  const name = session.profiles?.full_name || "מועמד";
  const score = session.final_beqa_score?.toFixed(1) || "—";
  const psych = session.psychological_score?.toFixed(2) || "—";
  const date = new Date(session.created_at).toLocaleDateString("he-IL");
  const reportNo = session.id.substring(1, 8).toUpperCase();
  const today = new Date().toLocaleDateString("he-IL");
  const community =
    session.community_type === "ethiopian"
      ? "אתיופי"
      : session.community_type === "russian"
        ? "רוסי"
        : "קוקי";
  const rec = session.recommendation;
  const recLabel =
    rec === "A"
      ? "מומלץ מאוד — כשיר לרכב ציבורי"
      : rec === "B"
        ? "מומלץ לראיון נוסף"
        : "לא מומלץ כרגע — נדרשת הכנה";
  const recColor = rec === "A" ? "#27AE60" : rec === "B" ? "#E67E22" : "#C0392B";
  const answers = session.answers || {};

  const qLabels: Record<string, string> = {
    q1: "מוטיבציה ומכוונות מקצועית",
    q2: "שליטה עצמית בפני גירוי חברתי",
    q3: "אחריות ומודעות בטיחותית",
    q4: "הכרת חוק שעות נהיגה",
    q5: "חוסן פסיכולוגי לאחר כישלון",
    q6: "מערכת תמיכה ויציבות חיצונית",
    q7: "גמישות תקשורתית בין-תרבותית",
    q8: "מחויבות לתהליך למידה",
    q9: "ריאליות ציפיות שכר",
    q10: "זהות מקצועית כנהג",
    qe1: "חוסן תרבותי — קהילה",
    qe2: "ערכים קהילתיים",
    qe3: "אומץ מול אתגרים",
    qp: "קבלת החלטות תחת לחץ",
  };

  const qAnalysis: Record<string, string> = {
    q1: "המועמד הביע מוטיבציה עמוקה ואמיתית לעסוק במקצוע — לא כברירת מחדל אלא כבחירה מודעת.",
    q2: "תגובתיות מסוימת בפני גירויים חברתיים — תחום הדורש תשומת לב בראיון נוסף.",
    q3: "תגובה מושלמת — המועמד לא יצא לדרך עם תקלה ידועה. הבנה עמוקה של אחריות לנוסעים.",
    q4: "הכרה מלאה של הגבלות שעות נהיגה החוקיות. ידע בסיסי חיוני לבטיחות הציבור.",
    q5: "חוסן טוב עם יכולת התאוששות. קיים קושי קל בהפקת לקחים מלאה מכישלון.",
    q6: "עורף משפחתי תומך — גורם יציבות מרכזי המפחית נשירה מקצועית.",
    q7: "יכולת גבוהה לניהול תקשורת במצבי אי-הבנה לשונית — כישור קריטי בסביבה רב-לשונית.",
    q8: "מחויבות גבוהה לתהליך ההכשרה. מבין שהרישיון הוא תהליך ולא אירוע חד-פעמי.",
    q9: "ציפיות ריאליות ומותאמות לשוק — מנבא יציבות תעסוקתית.",
    q10: "מזדהה עם תפקיד הנהג כמקצוע — מנבא מוסר עבודה ואיכות שירות גבוהים.",
    qe1: "ביטוי גבוה של חוסן בהקשר תרבותי — מוכנות לשאת בכישלון ולנסות שוב.",
    qe2: "הקהילה כמקור כוח — מנבא מחויבות ומוסר עבודה גבוהים.",
    qe3: "נכונות להתמודד עם מצבים מאיימים — תכונה הכרחית לנהג רכב ציבורי.",
    qp: "תגובה מיטבית לתרחיש הלחץ — עצירה בטוחה ודיווח מיידי. תגובה נכונה ביטחונית וחוקית.",
  };

  const answersRows = Object.entries(answers)
    .map(([k, v]) => {
      const val = v as number;
      const stars = "★".repeat(val) + "☆".repeat(4 - val);
      const color =
        val >= 4 ? "#27AE60" : val === 3 ? "#2E86AB" : val === 2 ? "#E67E22" : "#C0392B";
      const rating =
        val >= 4 ? "מצוין" : val === 3 ? "טוב" : val === 2 ? "בינוני" : "נמוך";
      return `<tr>
      <td style="padding:8px 10px;border-bottom:1px solid #f0f0f0;text-align:right;">${qLabels[k] || k}</td>
      <td style="padding:8px 10px;border-bottom:1px solid #f0f0f0;text-align:center;font-weight:bold;color:${color};letter-spacing:2px;">${stars}</td>
      <td style="padding:8px 10px;border-bottom:1px solid #f0f0f0;text-align:center;font-weight:bold;color:${color};">${val}/4</td>
      <td style="padding:8px 10px;border-bottom:1px solid #f0f0f0;text-align:right;color:${color};">${rating}</td>
      <td style="padding:8px 10px;border-bottom:1px solid #f0f0f0;font-size:11px;color:#777;">${qAnalysis[k] || ""}</td>
    </tr>`;
    })
    .join("");

  const strengths = Object.entries(answers)
    .filter(([, v]) => (v as number) >= 4)
    .map(([k]) => `<li style="color:#276749;font-size:12px;margin-bottom:6px;padding-right:8px;">${qLabels[k] || k}</li>`)
    .join("");
  const improvements = Object.entries(answers)
    .filter(([, v]) => (v as number) <= 2)
    .map(
      ([k, v]) =>
        `<li style="color:#9C4E00;font-size:12px;margin-bottom:6px;padding-right:8px;">${qLabels[k] || k} — ציון ${v}/4 — מומלץ לחזק</li>`,
    )
    .join("");

  const html = `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
<meta charset="UTF-8">
<title>דוח BEQA — ${name} — ${reportNo}</title>
<style>
* { box-sizing:border-box; margin:0; padding:0; }
body { font-family:Arial,sans-serif; direction:rtl; color:#0D1B2A; background:#fff; font-size:13px; }
.page { max-width:820px; margin:0 auto; padding:0; }

/* כריכה */
.cover { background:#0D1B2A; color:#fff; padding:50px 40px; text-align:center; position:relative; }
.cover::after { content:''; position:absolute; bottom:0; left:0; right:1; height:5px; background:linear-gradient(90deg,#C9A84C,#F0D080,#C9A84C); }
.cover .logo { font-size:38px; font-weight:bold; color:#C9A84C; letter-spacing:2px; margin-bottom:6px; }
.cover .subtitle { font-size:16px; color:#aaa; margin-bottom:30px; }
.cover .score-circle { width:140px; height:140px; border-radius:50%; border:6px solid #C9A84C; margin:0 auto 20px; display:flex; flex-direction:column; align-items:center; justify-content:center; }
.cover .score-num { font-size:44px; font-weight:bold; color:#C9A84C; line-height:1; }
.cover .score-of { font-size:13px; color:#777; }
.cover .rec-badge { display:inline-block; padding:10px 30px; border:2px solid ${recColor}; border-radius:30px; color:${recColor}; font-size:15px; font-weight:bold; margin-bottom:24px; }
.cover .conf { font-size:10px; color:#555; border-top:1px solid #333; padding-top:14px; margin-top:10px; }

/* תוכן */
.content { padding:30px 40px; }
.section { margin-bottom:28px; page-break-inside:avoid; }
.section-title { font-size:17px; font-weight:bold; color:#0D1B2A; border-right:5px solid #C9A84C; padding-right:12px; margin-bottom:14px; }
.section-title .pg { float:left; font-size:11px; color:#aaa; font-weight:normal; margin-top:3px; }

/* פרטים */
.info-grid { display:grid; grid-template-columns:1fr 1fr; gap:10px; }
.info-item { background:#F4F6FA; padding:10px 14px; border-radius:6px; border-right:3px solid #C9A84C; }
.info-item .lbl { font-size:10px; color:#7A8FA6; margin-bottom:3px; text-transform:uppercase; letter-spacing:0.5px; }
.info-item .val { font-size:14px; font-weight:bold; color:#0D1B2A; }

/* ציונים */
.score-row { display:grid; grid-template-columns:repeat(3,1fr); gap:14px; margin-bottom:16px; }
.score-box { background:#0D1B2A; padding:18px 12px; border-radius:8px; text-align:center; }
.score-box .num { font-size:30px; font-weight:bold; color:#C9A84C; }
.score-box .lbl { font-size:10px; color:#7A8FA6; margin-top:4px; }

/* טבלה */
table { width:100%; border-collapse:collapse; font-size:12px; }
th { background:#0D1B2A; color:#C9A84C; padding:9px 10px; text-align:right; font-size:11px; font-weight:bold; }
td { padding:8px 10px; border-bottom:1px solid #f0f0f0; vertical-align:top; }
tr:nth-child(even) { background:#F8FAFC; }

/* המלצות */
.two-col { display:grid; grid-template-columns:1fr 1fr; gap:20px; }
.strength-box { background:#F0FFF4; border:1px solid #27AE60; border-radius:8px; padding:16px; }
.strength-box h4 { color:#27AE60; margin-bottom:10px; font-size:13px; }
.improve-box { background:#FFFBF0; border:1px solid #E67E22; border-radius:8px; padding:16px; }
.improve-box h4 { color:#E67E22; margin-bottom:10px; font-size:13px; }

/* החלטה */
.decision-box { border:3px solid ${recColor}; border-radius:10px; padding:24px; text-align:center; margin:20px 0; }
.decision-box .grade { font-size:70px; font-weight:bold; color:${recColor}; line-height:1; }
.decision-box .rec-text { font-size:17px; font-weight:bold; color:${recColor}; margin:8px 0; }
.decision-box .desc { font-size:12px; color:#555; line-height:1.7; max-width:500px; margin:0 auto; }

/* חתימות */
.sig-grid { display:grid; grid-template-columns:1fr 1fr; gap:20px; margin-top:20px; }
.sig-item { border-top:1px solid #ddd; padding-top:10px; }
.sig-item .sig-label { font-size:10px; color:#aaa; margin-bottom:4px; }
.sig-item .sig-val { font-size:12px; color:#0D1B2A; font-weight:bold; }

/* פוטר */
.footer { background:#F4F6FA; padding:14px 40px; text-align:center; font-size:10px; color:#aaa; border-top:2px solid #C9A84C; margin-top:20px; }

/* הדפסה */
@media print {
  .no-print { display:none !important; }
  .page { padding:0; }
  .content { padding:20px 30px; }
  .cover { padding:40px 30px; }
}
</style>
</head>
<body>
<div class="page">

<!-- ════ עמוד 1 — כריכה ════ -->
<div class="cover">
  <div class="logo">Haile Drive AI</div>
  <div class="subtitle">דוח אבחון פסיכולוגי-תעסוקתי מקיף<br>BEQA — Biometric Educational Quality Assessment</div>
  <div class="score-circle">
    <div class="score-num">${score}</div>
    <div class="score-of">/ 100</div>
  </div>
  <div class="rec-badge">${recLabel}</div>
  <div class="conf">
    סודי — לשימוש מקצועי בלבד &nbsp;|&nbsp; משרד התחבורה &nbsp;|&nbsp; רשות הרישוי<br>
    מסמך זה מיועד להגשה רשמית בלבד
  </div>
</div>

<!-- ════ תוכן ════ -->
<div class="content">

<!-- פרטי מועמד -->
<div class="section">
  <div class="section-title">פרטי המועמד <span class="pg">עמוד 1/6</span></div>
  <div class="info-grid">
    <div class="info-item"><div class="lbl">שם מלא</div><div class="val">${name}</div></div>
    <div class="info-item"><div class="lbl">תאריך אבחון</div><div class="val">${date}</div></div>
    <div class="info-item"><div class="lbl">קהילה ושפה</div><div class="val">${community}</div></div>
    <div class="info-item"><div class="lbl">מספר דוח</div><div class="val">BEQA-2026-${reportNo}</div></div>
    <div class="info-item"><div class="lbl">גורם מאבחן</div><div class="val">Haile Drive AI BEQA v1.0</div></div>
    <div class="info-item"><div class="lbl">תאריך הפקה</div><div class="val">${today}</div></div>
  </div>
</div>

<!-- ציונים -->
<div class="section">
  <div class="section-title">ציונים מרכזיים <span class="pg">עמוד 2/6</span></div>
  <div class="score-row">
    <div class="score-box"><div class="num">${score}</div><div class="lbl">ציון BEQA כולל</div></div>
    <div class="score-box"><div class="num">${psych}/4</div><div class="lbl">ציון פסיכולוגי</div></div>
    <div class="score-box"><div class="num" style="color:${recColor}">${rec}</div><div class="lbl">דרגת המלצה</div></div>
  </div>
  <p style="font-size:11px;color:#7A8FA6;background:#F4F6FA;padding:10px;border-radius:6px;">
    ⚡ הדוח מבוסס על האבחון הפסיכולוגי המושלם (14 שאלות). 
    מדדים ביומטריים (rPPG, ניתוח פנים) יתווספו עם חיבור חיישנים מאושרים — שלב ב של המערכת.
  </p>
</div>

<!-- ניתוח שאלות -->
<div class="section">
  <div class="section-title">ניתוח פסיכולוגי מפורט — שאלה אחר שאלה <span class="pg">עמוד 3/6</span></div>
  <p style="font-size:11px;color:#777;margin-bottom:10px;">
    האבחון מבוסס על 14 שאלות שנבנו בהתאם למתודולוגיית פסיכולוג תעסוקתי מומחה לקהילות אתיופית, רוסית ושבט המנשה.
  </p>
  <table>
    <thead><tr>
      <th style="width:25%">מדד</th>
      <th style="width:12%;text-align:center">ציון</th>
      <th style="width:8%;text-align:center">1–4</th>
      <th style="width:10%">הערכה</th>
      <th style="width:45%">פרשנות מקצועית</th>
    </tr></thead>
    <tbody>${answersRows || '<tr><td colspan="5" style="padding:12px;text-align:center;color:#999;">אין נתוני שאלות</td></tr>'}</tbody>
  </table>
</div>

<!-- פרופיל -->
<div class="section">
  <div class="section-title">פרופיל אישיות וגורמי סיכון/הגנה <span class="pg">עמוד 4/6</span></div>
  <div class="two-col">
    <div class="strength-box">
      <h4>✔ חוזקות שזוהו</h4>
      <ul style="list-style:none;padding:1;">${strengths || '<li style="color:#276749;font-size:12px;padding-right:8px;">לא זוהו חוזקות בציון 4/4</li>'}</ul>
    </div>
    <div class="improve-box">
      <h4>◆ תחומים לחיזוק</h4>
      <ul style="list-style:none;padding:1;">${improvements || '<li style="color:#9C4E00;font-size:12px;padding-right:8px;">לא זוהו תחומים קריטיים לחיזוק</li>'}</ul>
    </div>
  </div>
</div>

<!-- המלצות -->
<div class="section">
  <div class="section-title">המלצות מקצועיות ונתיב פעולה <span class="pg">עמוד 5/6</span></div>
  <p style="font-weight:bold;margin-bottom:8px;color:#0D1B2A;">המלצות מיידיות:</p>
  <ol style="padding-right:20px;line-height:2;">
    ${rec === "B"
      ? `
    <li>לקיים ראיון פנים-אל-פנים נוסף תוך 30 יום, עם דגש על שליטה עצמית בתרחישי עימות</li>
    <li>להשלים מבחן תיאוריה רשמי לפני קביעת מועד מרב"ד</li>
    <li>לשלב המועמד בסימולטור נהיגה ובמבחני הכנה של Haile Drive AI</li>
    <li>לבצע אבחון BEQA מלא עם חיישנים ביומטריים לאחר חיבור SDK</li>
    `
      : rec === "A"
        ? `
    <li>המועמד כשיר לשלב המרב"ד הרשמי — מומלץ לתאם מועד בהקדם</li>
    <li>להשלים מבחן תיאוריה רשמי</li>
    <li>מעקב שוטף במהלך ההכשרה</li>
    `
        : `
    <li>נדרשת הכנה נוספת — לחזור לתהליך הכשרה עם Haile Drive AI</li>
    <li>לאבחן מחדש בעוד 60 יום</li>
    <li>לחזק תחומים שזוהו כחלשים</li>
    `}
  </ol>
</div>

<!-- החלטה -->
<div class="section">
  <div class="section-title">החלטה סופית <span class="pg">עמוד 6/6</span></div>
  <div class="decision-box">
    <div class="grade">${rec}</div>
    <div class="rec-text">${recLabel}</div>
    <div class="desc">
      ${rec === "A"
        ? 'המועמד עומד בכל דרישות הכשירות לנהג רכב ציבורי. מומלץ להמשיך לשלב המרב"ד הרשמי.'
        : rec === "B"
          ? "המועמד מציג פרופיל חיובי עם נקודה הדורשת בחינה נוספת. מומלץ ראיון פנים-אל-פנים תוך 30 יום."
          : "המועמד זקוק להכנה נוספת. מומלץ לחזור לתהליך הכשרה ולאבחן מחדש בעוד 60 יום."}
    </div>
  </div>

  <!-- חתימות -->
  <div class="sig-grid">
    <div class="sig-item">
      <div class="sig-label">גורם מאבחן</div>
      <div class="sig-val">Haile Drive AI BEQA v1.0</div>
    </div>
    <div class="sig-item">
      <div class="sig-label">תאריך הפקת הדוח</div>
      <div class="sig-val">${today}</div>
    </div>
    <div class="sig-item">
      <div class="sig-label">מספר דוח</div>
      <div class="sig-val">BEQA-2026-${reportNo}</div>
    </div>
    <div class="sig-item">
      <div class="sig-label">גרסת אלגוריתם</div>
      <div class="sig-val">Psych-v1.0 | Hebrew-Amharic Validated</div>
    </div>
  </div>
</div>

</div><!-- end content -->

<!-- פוטר -->
<div class="footer">
  <strong>Haile Drive AI</strong> &nbsp;|&nbsp; haileai.app &nbsp;|&nbsp; 054-873-9473 &nbsp;|&nbsp;
  דוח מספר: BEQA-2026-${reportNo} &nbsp;|&nbsp; הופק: ${today}<br>
  מסמך זה הוכן לצורך הגשה למשרד התחבורה ורשות הרישוי &nbsp;|&nbsp; © 2026 Haile Drive AI — כל הזכויות שמורות
</div>

<!-- כפתור הדפסה -->
<div class="no-print" style="text-align:center;padding:24px;">
  <button onclick="window.print()" style="background:#C9A84C;color:#0D1B2A;border:none;padding:16px 48px;font-size:16px;font-weight:bold;border-radius:8px;cursor:pointer;box-shadow:0 4px 12px rgba(201,168,76,0.3);">
    🖨️ שמור כ-PDF
  </button>
</div>

</div>
</body>
</html>`;

  const win = window.open("", "_blank");
  if (win) {
    win.document.write(html);
    win.document.close();
  }
}

function AdminDiagnosticsPage() {
  const [rows, setRows] = useState<DiagnosticSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data: sessions, error } = await supabase
        .from("beqa_diagnostic_sessions")
        .select(
          "id, student_id, created_at, final_beqa_score, accuracy_score, recommendation, psychological_score, community_type, answers",
        )
        .order("created_at", { ascending: false });
      if (!active) return;
      if (error) {
        setErr(error.message);
        setLoading(false);
        return;
      }

      const merged: DiagnosticSession[] = (sessions ?? []).map((s) => ({
        ...s,
        answers: (s.answers as Record<string, number> | null) ?? null,
        profiles: null,
      }));
      const studentIds = merged.map((s) => s.student_id).filter(Boolean) as string[];
      if (studentIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, full_name, email")
          .in("id", studentIds);
        const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));
        for (const row of merged) {
          if (row.student_id) {
            row.profiles = profileMap.get(row.student_id) ?? null;
          }
        }
      }

      if (!active) return;
      setRows(merged);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, []);

  return (
    <AdminShell title="דוחות אבחון" roles={["owner", "staff"]}>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">אבחוני BEQA</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <AdminLoading />
          ) : err ? (
            <div className="text-sm text-rose-400">שגיאה בטעינה: {err}</div>
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">אין אבחונים עדיין</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">תאריך</TableHead>
                  <TableHead className="text-right">שם מועמד</TableHead>
                  <TableHead className="text-right">ציון BEQA</TableHead>
                  <TableHead className="text-right">דיוק</TableHead>
                  <TableHead className="text-right">כפתור</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((session) => (
                  <TableRow key={session?.id}>
                    <TableCell>
                      {session?.created_at
                        ? new Date(session.created_at).toLocaleDateString("he-IL")
                        : "—"}
                    </TableCell>
                    <TableCell>
                      {session?.profiles?.full_name || session?.student_id?.substring(0, 8) || "—"}
                    </TableCell>
                    <TableCell>{session?.final_beqa_score?.toFixed(1) ?? "—"}</TableCell>
                    <TableCell>{session?.accuracy_score?.toFixed(1) ?? "—"}</TableCell>
                    <TableCell>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => generateBeqaReport(session)}
                      >
                        📄 הפק דוח
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </AdminShell>
  );
}
