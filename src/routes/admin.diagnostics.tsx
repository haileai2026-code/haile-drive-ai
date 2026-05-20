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

function generateBeqaReport(session: DiagnosticSession) {
  const name = session.profiles?.full_name || "מועמד";
  const score = session.final_beqa_score?.toFixed(1) || "—";
  const psych = session.psychological_score?.toFixed(2) || "—";
  const date = new Date(session.created_at).toLocaleDateString("he-IL");
  const rec =
    session.recommendation === "A"
      ? 'מומלץ מאוד — כשיר לרכב ציבורי'
      : session.recommendation === "B"
        ? "מומלץ לראיון נוסף"
        : "לא מומלץ כרגע — נדרשת הכנה נוספת";
  const recColor =
    session.recommendation === "A"
      ? "#27AE60"
      : session.recommendation === "B"
        ? "#E67E22"
        : "#C0392B";
  const community =
    session.community_type === "ethiopian"
      ? "אתיופי"
      : session.community_type === "russian"
        ? "רוסי"
        : session.community_type === "kuki"
          ? "קוקי"
          : "—";

  const answers = session.answers || {};
  const qLabels: Record<string, string> = {
    q1: "מוטיבציה לנהיגה",
    q2: "שליטה עצמית",
    q3: "אחריות בטיחותית",
    q4: "הכרת חוק שעות נהיגה",
    q5: "חוסן לאחר כישלון",
    q6: "תמיכה משפחתית",
    q7: "תקשורת — חסם שפה",
    q8: "מחויבות ללמידה",
    q9: "ציפיות שכר",
    q10: "זהות מקצועית",
    qe1: "חוסן קהילתי",
    qe2: "ערכים קהילתיים",
    qe3: "אומץ התמודדות",
    qp: "קבלת החלטות תחת לחץ",
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
      <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:right;">${qLabels[k] || k}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:center;font-weight:bold;color:${color};">${stars}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:center;font-weight:bold;color:${color};">${val}/4</td>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:right;color:${color};">${rating}</td>
    </tr>`;
    })
    .join("");

  const strengths = Object.entries(answers)
    .filter(([, v]) => (v as number) >= 4)
    .map(([k]) => `<div class="strength">✔ ${qLabels[k] || k} — מעולה</div>`)
    .join("");
  const improvements = Object.entries(answers)
    .filter(([, v]) => (v as number) <= 2)
    .map(
      ([k, v]) =>
        `<div class="improve">◆ ${qLabels[k] || k} — ציון ${v}/4 — מומלץ לחזק</div>`,
    )
    .join("");
  const noImprovements =
    Object.entries(answers).filter(([, v]) => (v as number) <= 2).length === 0;

  const reportId = session.id.substring(0, 8).toUpperCase();

  const html = `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
<meta charset="UTF-8">
<title>דוח BEQA — ${name}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, sans-serif; direction: rtl; color: #0D1B2A; background: #fff; }
  .page { max-width: 800px; margin: 0 auto; padding: 40px; }
  .cover { background: #0D1B2A; color: #C9A84C; padding: 40px; text-align: center; border-radius: 8px; margin-bottom: 32px; }
  .cover h1 { font-size: 36px; font-weight: bold; margin-bottom: 8px; }
  .cover h2 { font-size: 18px; color: #aaa; font-weight: normal; margin-bottom: 24px; }
  .cover .score-big { font-size: 80px; font-weight: bold; color: #C9A84C; line-height: 1; }
  .cover .score-label { font-size: 14px; color: #aaa; margin-top: 8px; }
  .cover .rec { display: inline-block; padding: 10px 28px; border-radius: 6px; font-size: 16px; font-weight: bold; margin-top: 16px; background: rgba(255,255,255,0.1); color: ${recColor}; border: 2px solid ${recColor}; }
  .cover .conf { font-size: 11px; color: #666; margin-top: 20px; }
  .section { margin-bottom: 28px; }
  .section-title { font-size: 18px; font-weight: bold; color: #0D1B2A; border-bottom: 2px solid #C9A84C; padding-bottom: 6px; margin-bottom: 14px; }
  .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  .info-item { background: #F4F6FA; padding: 10px 14px; border-radius: 6px; }
  .info-item .lbl { font-size: 11px; color: #7A8FA6; margin-bottom: 3px; }
  .info-item .val { font-size: 14px; font-weight: bold; color: #0D1B2A; }
  .score-summary { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; margin-bottom: 20px; }
  .score-card { background: #0D1B2A; color: #C9A84C; padding: 16px; border-radius: 8px; text-align: center; }
  .score-card .num { font-size: 32px; font-weight: bold; }
  .score-card .lbl { font-size: 11px; color: #7A8FA6; margin-top: 4px; }
  table { width: 100%; border-collapse: collapse; }
  th { background: #0D1B2A; color: #C9A84C; padding: 10px 12px; text-align: right; font-size: 13px; }
  tr:nth-child(even) { background: #F4F6FA; }
  .strength { color: #27AE60; padding: 6px 0; font-size: 13px; }
  .improve  { color: #E67E22; padding: 6px 0; font-size: 13px; }
  .decision { background: #F4F6FA; border: 2px solid ${recColor}; border-radius: 8px; padding: 20px; text-align: center; margin: 20px 0; }
  .decision .grade { font-size: 60px; font-weight: bold; color: ${recColor}; line-height: 1; }
  .decision .rec-text { font-size: 16px; font-weight: bold; color: ${recColor}; margin-top: 8px; }
  .decision .desc { font-size: 13px; color: #4A5568; margin-top: 10px; line-height: 1.6; }
  .footer { margin-top: 32px; border-top: 1px solid #eee; padding-top: 12px; text-align: center; font-size: 10px; color: #aaa; }
  @media print {
    .no-print { display: none; }
    .page { padding: 20px; }
  }
</style>
</head>
<body>
<div class="page">
  <div class="cover">
    <h1>Haile Drive AI</h1>
    <h2>דוח אבחון פסיכולוגי-תעסוקתי</h2>
    <div class="score-big">${score}</div>
    <div class="score-label">ציון BEQA מתוך 100</div>
    <div class="rec">${rec}</div>
    <div class="conf">סודי — לשימוש מקצועי בלבד | משרד התחבורה | רשות הרישוי</div>
  </div>

  <div class="section">
    <div class="section-title">פרטי המועמד</div>
    <div class="info-grid">
      <div class="info-item"><div class="lbl">שם מלא</div><div class="val">${name}</div></div>
      <div class="info-item"><div class="lbl">תאריך אבחון</div><div class="val">${date}</div></div>
      <div class="info-item"><div class="lbl">קהילה</div><div class="val">${community}</div></div>
      <div class="info-item"><div class="lbl">מספר דוח</div><div class="val">${reportId}</div></div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">ציונים מרכזיים</div>
    <div class="score-summary">
      <div class="score-card"><div class="num">${score}</div><div class="lbl">ציון BEQA כולל</div></div>
      <div class="score-card"><div class="num">${psych}/4</div><div class="lbl">ציון פסיכולוגי</div></div>
      <div class="score-card"><div class="num" style="color:${recColor}">${session.recommendation || "B"}</div><div class="lbl">דרגת המלצה</div></div>
    </div>
    <p style="font-size:12px;color:#7A8FA6;text-align:right;">
      ⚡ הערה: הדוח מבוסס על האבחון הפסיכולוגי המושלם.
      מדדים ביומטריים (rPPG, ניתוח פנים) יתווספו עם חיבור חיישנים מאושרים.
    </p>
  </div>

  <div class="section">
    <div class="section-title">ניתוח פסיכולוגי — שאלה אחר שאלה</div>
    <table>
      <thead><tr>
        <th>מדד</th><th style="text-align:center">ציון</th>
        <th style="text-align:center">1–4</th><th>הערכה</th>
      </tr></thead>
      <tbody>${answersRows || '<tr><td colspan="4" style="padding:12px;text-align:center;color:#999;">אין נתוני שאלות</td></tr>'}</tbody>
    </table>
  </div>

  <div class="section">
    <div class="section-title">ממצאים והמלצות</div>
    <p style="font-weight:bold;color:#27AE60;margin-bottom:8px;">חוזקות שזוהו:</p>
    ${strengths || '<div class="strength">—</div>'}
    <br>
    <p style="font-weight:bold;color:#E67E22;margin-bottom:8px;">תחומים לחיזוק:</p>
    ${improvements}
    ${noImprovements ? '<div class="strength">✔ אין תחומים קריטיים לחיזוק</div>' : ""}
  </div>

  <div class="section">
    <div class="section-title">החלטה סופית</div>
    <div class="decision">
      <div class="grade">${session.recommendation || "B"}</div>
      <div class="rec-text">${rec}</div>
      <div class="desc">
        ${
          session.recommendation === "A"
            ? 'המועמד עומד בכל דרישות הכשירות לנהג רכב ציבורי. מומלץ להמשיך לשלב המרב"ד הרשמי.'
            : session.recommendation === "B"
              ? "המועמד מציג פרופיל חיובי עם נקודה אחת הדורשת בחינה נוספת. מומלץ לקיים ראיון פנים-אל-פנים תוך 30 יום."
              : "המועמד זקוק להכנה נוספת. מומלץ לחזור לתהליך הכשרה עם Haile Drive AI ולאבחן מחדש בעוד 60 יום."
        }
      </div>
    </div>
  </div>

  <div class="footer">
    <p>Haile Drive AI | haileai.app | 054-873-9473</p>
    <p>דוח מספר: ${reportId} | הופק: ${new Date().toLocaleDateString("he-IL")}</p>
    <p>© 2026 Haile Drive AI | כל הזכויות שמורות | מסמך זה מיועד להגשה רשמית בלבד</p>
  </div>

  <div class="no-print" style="text-align:center;margin-top:24px;">
    <button onclick="window.print()" style="background:#C9A84C;color:#0D1B2A;border:none;padding:14px 40px;font-size:16px;font-weight:bold;border-radius:8px;cursor:pointer;">
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
