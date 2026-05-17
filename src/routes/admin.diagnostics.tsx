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
import { generateDiagnosticPdf } from "@/lib/diagnostics/pdf-report";
import { toast } from "sonner";

type DiagnosticSession = {
  id: string;
  student_id: string | null;
  created_at: string;
  final_beqa_score: number | null;
  accuracy_score: number | null;
  baseline_hr: number | null;
  stress_hr: number | null;
};

export const Route = createFileRoute("/admin/diagnostics")({
  head: () => ({ meta: [{ title: "דוחות אבחון — Owner" }] }),
  component: AdminDiagnosticsPage,
});

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
          "id, student_id, created_at, final_beqa_score, accuracy_score, baseline_hr, stress_hr",
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
                  <TableHead className="text-right">student_id</TableHead>
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
                    <TableCell className="font-mono text-xs">
                      {session?.student_id ?? "—"}
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
                            const { data: full, error: fErr } = await supabase
                              .from("beqa_diagnostic_sessions")
                              .select("*")
                              .eq("id", session.id)
                              .maybeSingle();
                            if (fErr || !full) throw fErr ?? new Error("not found");
                            let profile = undefined as
                              | { id: string; full_name: string | null; email: string | null }
                              | undefined;
                            if (full.student_id) {
                              const { data: p } = await supabase
                                .from("profiles")
                                .select("id, full_name, email")
                                .eq("id", full.student_id)
                                .maybeSingle();
                              profile = p ?? undefined;
                            }
                            const mapped = {
                              ...full,
                              start_time: (full as { start_time?: string; created_at?: string }).start_time
                                ?? (full as { created_at?: string }).created_at
                                ?? new Date().toISOString(),
                            };
                            await generateDiagnosticPdf(mapped as never, profile);
                          } catch (e) {
                            console.error(e);
                            toast.error("שגיאה ביצירת PDF");
                          }
                        }}
                      >
                        הורד PDF
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
