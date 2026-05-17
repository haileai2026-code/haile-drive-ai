import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AdminShell, AdminLoading } from "@/components/AdminShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/admin/diagnostics")({
  head: () => ({ meta: [{ title: "דוחות אבחון — Owner" }] }),
  component: AdminDiagnosticsPage,
});

function AdminDiagnosticsPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [detail, setDetail] = useState<any | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data, error } = await supabase
        .from("beqa_diagnostic_sessions")
        .select("*")
        .order("created_at", { ascending: false });
      if (!active) return;
      if (error) setErr(error.message);
      else setRows(data ?? []);
      setLoading(false);
    })();
    return () => { active = false; };
  }, []);

  return (
    <AdminShell title="דוחות אבחון" roles={["owner", "staff"]}>
      <Card>
        <CardHeader><CardTitle className="text-base">אבחוני BEQA</CardTitle></CardHeader>
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
                  <TableHead className="text-right">מזהה סטודנט</TableHead>
                  <TableHead className="text-right">תאריך</TableHead>
                  <TableHead className="text-right">ציון BEQA</TableHead>
                  <TableHead className="text-right">דיוק</TableHead>
                  <TableHead className="text-right"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono text-xs">
                      {r.student_id ? String(r.student_id).slice(0, 8) : "—"}
                    </TableCell>
                    <TableCell>
                      {r.created_at ? new Date(r.created_at).toLocaleString("he-IL") : "—"}
                    </TableCell>
                    <TableCell>
                      {r.final_beqa_score == null ? "טרם חושב" : Math.round(Number(r.final_beqa_score))}
                    </TableCell>
                    <TableCell>
                      {r.accuracy_score == null ? "—" : `${Math.round(Number(r.accuracy_score) * 100)}%`}
                    </TableCell>
                    <TableCell>
                      <Button type="button" variant="outline" size="sm" onClick={() => setDetail(r)}>
                        פרטים
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {detail && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4" onClick={() => setDetail(null)}>
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-2xl rounded-2xl border border-border bg-background p-5" dir="rtl">
            <h3 className="mb-3 text-lg font-bold">פרטי אבחון</h3>
            <pre className="max-h-[60vh] overflow-auto rounded-lg bg-muted/30 p-3 text-xs" dir="ltr">
              {JSON.stringify(detail, null, 2)}
            </pre>
            <div className="mt-3 flex justify-end">
              <Button variant="outline" size="sm" onClick={() => setDetail(null)}>סגור</Button>
            </div>
          </div>
        </div>
      )}
    </AdminShell>
  );
}
