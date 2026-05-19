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

import { toast } from "sonner";

type DiagnosticSession = {
  id: string;
  student_id: string | null;
  created_at: string;
  final_beqa_score: number | null;
  accuracy_score: number | null;
  recommendation: string | null;
  profiles: { full_name: string | null; email: string | null } | null;
};

export const Route = createFileRoute("/admin/diagnostics")({
  head: () => ({ meta: [{ title: "דוחות אבחון — Owner" }] }),
  component: AdminDiagnosticsPage,
});

function generateReport(session: DiagnosticSession) {
  const name = session.profiles?.full_name || session.student_id?.substring(0, 8) || "מועמד";
  const score = session.final_beqa_score?.toFixed(1) || "—";
  const accuracy = session.accuracy_score?.toFixed(1) || "—";
  const date = new Date(session.created_at).toLocaleDateString("he-IL");
  const rec =
    session.recommendation === "A"
      ? "מומלץ מאוד"
      : session.recommendation === "B"
        ? "ראיון נוסף מומלץ"
        : "לא מומלץ כרגע";

  const html = `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head><meta charset="UTF-8"><title>דוח BEQA</title>
<style>
body{font-family:Arial,sans-serif;direction:rtl;margin:40px;color:#0D1B2A}
h1{color:#C9A84C;border-bottom:2px solid #C9A84C;padding-bottom:8px}
h2{color:#0D1B2A;margin-top:24px}
table{width:100%;border-collapse:collapse;margin:16px 0}
td{padding:10px 14px;border-bottom:1px solid #eee;font-size:14px}
td:first-child{font-weight:bold;color:#0D1B2A;width:200px}
td:last-child{color:#555}
.score{font-size:48px;font-weight:bold;color:#C9A84C;text-align:center;padding:20px}
.rec{text-align:center;font-size:18px;font-weight:bold;padding:10px;border-radius:6px;margin:10px auto;width:300px}
.rec-B{background:#FFF9E6;color:#C9A84C;border:1px solid #C9A84C}
.rec-A{background:#E8F5E9;color:#27AE60;border:1px solid #27AE60}
.rec-C{background:#FFEBEE;color:#ef4444;border:1px solid #ef4444}
.footer{margin-top:40px;border-top:1px solid #eee;padding-top:10px;text-align:center;font-size:11px;color:#aaa}
@media print{button{display:none}}
</style></head>
<body>
<h1>Haile Drive AI — תיק אבחון פסיכולוגי-תעסוקתי</h1>
<p style="color:#aaa;text-align:center;font-size:12px">סודי — לשימוש מקצועי בלבד</p>
<table>
  <tr><td>שם המועמד:</td><td>${name}</td></tr>
  <tr><td>תאריך אבחון:</td><td>${date}</td></tr>
  <tr><td>מספר דוח:</td><td>${String(session.id).substring(0, 8).toUpperCase()}</td></tr>
</table>
<h2>ציון BEQA הסופי</h2>
<div class="score">${score} / 100</div>
<div class="rec rec-${session.recommendation || "B"}">${rec}</div>
<h2>פירוט</h2>
<table>
  <tr><td>ציון דיוק:</td><td>${accuracy}%</td></tr>
  <tr><td>המלצה:</td><td>${rec}</td></tr>
</table>
<h2>המלצות</h2>
<p>✔ מוכן להמשך תהליך ההכשרה</p>
<p>◆ מומלץ ראיון נוסף לאחר 30 יום</p>
<p>◆ השלמת מבחן תיאוריה לפני המרב"ד</p>
<div class="footer">Haile Drive AI | haileai.app | ${new Date().toLocaleDateString("he-IL")}</div>
<br>
<button onclick="window.print()" style="background:#C9A84C;color:#0D1B2A;border:none;padding:12px 32px;font-size:16px;font-weight:bold;border-radius:6px;cursor:pointer;display:block;margin:0 auto">🖨️ שמור כ-PDF</button>
</body></html>`;

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
          `id, student_id, created_at, final_beqa_score, accuracy_score, recommendation, profiles!student_id (full_name, email)`,
        )
        .order("created_at", { ascending: false });
      if (!active) return;
      if (error) setErr(error.message);
      else setRows(sessions ?? []);
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
                        onClick={async () => {
                          try {
                            await generateBeqaDocx(session.id);
                          } catch (e) {
                            console.error(e);
                            toast.error("שגיאה ביצירת הדוח");
                          }
                        }}
                      >
                        הורד Word
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
