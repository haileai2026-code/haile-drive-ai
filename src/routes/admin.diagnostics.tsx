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

export const Route = createFileRoute("/admin/diagnostics")({
  head: () => ({ meta: [{ title: "דוחות אבחון — Owner" }] }),
  component: AdminDiagnosticsPage,
});

type DiagnosticRow = {
  id: string;
  student_id: string | null;
  created_at: string | null;
  final_beqa_score: number | null;
  accuracy_score: number | null;
};

function AdminDiagnosticsPage() {
  const [rows, setRows] = useState<DiagnosticRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function loadDiagnostics() {
      try {
        const { data, error } = await supabase
          .from("beqa_diagnostic_sessions")
          .select("id, student_id, created_at, final_beqa_score, accuracy_score")
          .order("created_at", { ascending: false });

        if (error) throw error;
        if (active) setRows((data ?? []) as DiagnosticRow[]);
      } catch (error) {
        console.error("Failed to load diagnostics", error);
        toast.error("שגיאה בטעינת האבחונים");
        if (active) setRows([]);
      } finally {
        if (active) setLoading(false);
      }
    }

    loadDiagnostics();
    return () => {
      active = false;
    };
  }, []);

  if (loading) {
    return (
      <AdminShell title="דוחות אבחון" roles={["owner", "staff"]}>
        <AdminLoading />
      </AdminShell>
    );
  }

  return (
    <AdminShell title="דוחות אבחון" roles={["owner", "staff"]}>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">אבחוני BEQA</CardTitle>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">אין אבחונים עדיין</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">שם סטודנט</TableHead>
                  <TableHead className="text-right">תאריך אבחון</TableHead>
                  <TableHead className="text-right">ציון BEQA</TableHead>
                  <TableHead className="text-right">דוח</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium">
                      {row.student_id ? row.student_id.slice(0, 8) : "לא ידוע"}
                    </TableCell>
                    <TableCell>
                      {row.created_at ? new Date(row.created_at).toLocaleString("he-IL") : "—"}
                    </TableCell>
                    <TableCell>
                      {row.final_beqa_score == null
                        ? "טרם הושלם"
                        : Math.round(row.final_beqa_score)}
                    </TableCell>
                    <TableCell>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => toast.info(`דוח אבחון: ${row.id}`)}
                      >
                        צפה בדוח
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