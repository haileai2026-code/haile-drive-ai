import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { useServerFn } from "@tanstack/react-start";
import { AdminShell, AdminLoading } from "@/components/AdminShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  listPhoneRequests,
  approvePhoneRequest,
  rejectPhoneRequest,
} from "@/lib/phone-login.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/phone-requests")({
  head: () => ({ meta: [{ title: "בקשות כניסה בטלפון — Owner" }] }),
  component: AdminPhoneRequestsPage,
});

type Row = {
  id: string;
  phone: string;
  status: string;
  created_at: string;
  expires_at: string;
  otp_plain: string | null;
};

function AdminPhoneRequestsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const listFn = useServerFn(listPhoneRequests);
  const approveFn = useServerFn(approvePhoneRequest);
  const rejectFn = useServerFn(rejectPhoneRequest);

  const load = useCallback(async () => {
    try {
      const res = await listFn();
      setRows((res?.rows ?? []) as Row[]);
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message ?? "שגיאת טעינה");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [listFn]);

  useEffect(() => { load(); }, [load]);

  const approve = async (id: string) => {
    setBusy(id);
    try {
      await approveFn({ data: { id } });
      toast.success("אושר — הסטודנט יכול להיכנס עם הקוד");
      await load();
    } catch (e: any) {
      toast.error(e?.message ?? "שגיאה");
    } finally { setBusy(null); }
  };
  const reject = async (id: string) => {
    setBusy(id);
    try {
      await rejectFn({ data: { id } });
      toast.success("נדחה");
      await load();
    } catch (e: any) {
      toast.error(e?.message ?? "שגיאה");
    } finally { setBusy(null); }
  };

  if (loading) return <AdminLoading />;

  return (
    <AdminShell title="בקשות כניסה בטלפון">
      <Card>
        <CardHeader>
          <CardTitle>בקשות פעילות ואחרונות</CardTitle>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">אין בקשות כרגע</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>טלפון</TableHead>
                  <TableHead>קוד</TableHead>

                  <TableHead>סטטוס</TableHead>
                  <TableHead>נשלח</TableHead>
                  <TableHead>פעולות</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => {
                  const expired = new Date(r.expires_at).getTime() < Date.now();
                  return (
                    <TableRow key={r.id}>
                      <TableCell className="font-mono">{r.phone}</TableCell>
                      <TableCell>
                        {r.otp_plain ? (
                          <span
                            className={`font-mono text-lg font-bold tracking-widest ${
                              r.status === "used" || expired
                                ? "text-muted-foreground/40 blur-[2px]"
                                : ""
                            }`}
                          >
                            {r.otp_plain}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={
                          r.status === "approved" ? "default" :
                          r.status === "pending" ? "secondary" :
                          r.status === "used" ? "outline" : "destructive"
                        }>
                          {r.status}{expired && r.status === "pending" ? " (פג)" : ""}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(r.created_at).toLocaleString("he-IL")}
                      </TableCell>
                      <TableCell className="flex gap-2">
                        {r.status === "pending" && (
                          <>
                            <Button size="sm" disabled={busy === r.id} onClick={() => approve(r.id)}>אשר</Button>
                            <Button size="sm" variant="outline" disabled={busy === r.id} onClick={() => reject(r.id)}>דחה</Button>
                          </>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </AdminShell>
  );
}
