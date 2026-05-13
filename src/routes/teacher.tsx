import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AdminShell, StatCard } from "@/components/AdminShell";
import { adminApi } from "@/lib/admin-api";
import { useAuth } from "@/lib/auth";
import { ClipboardCheck, Users, BookOpen } from "lucide-react";

export const Route = createFileRoute("/teacher")({
  head: () => ({ meta: [{ title: "מסך מורה — Haile Drive AI" }] }),
  component: TeacherDashboard,
});

const STATUS_LABELS: Record<string, string> = {
  new_lead: "ליד חדש", contacted: "נוצר קשר", missing_docs: "חסרים מסמכים",
  waiting_opening: "ממתין", assigned: "שובץ", active: "פעיל",
  completed: "סיים", inactive: "לא פעיל", failed: "נכשל",
};

function TeacherDashboard() {
  const { user, profile } = useAuth();
  const candidatesQ = useQuery({
    queryKey: ["my-candidates", user?.id],
    queryFn: () => adminApi.listCandidates({ teacherId: user!.id }),
    enabled: !!user,
  });
  const classesQ = useQuery({ queryKey: ["classes"], queryFn: adminApi.listClasses });
  const myClasses = (classesQ.data ?? []).filter((c) => c.teacher_id === user?.id);
  const candidates = candidatesQ.data ?? [];
  const active = candidates.filter((c) => c.status === "active").length;

  return (
    <AdminShell title={`שלום ${profile?.full_name ?? ""}`}>
      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="הכיתות שלי" value={myClasses.length} tone="gold" icon={BookOpen} />
        <StatCard label="התלמידים שלי" value={candidates.length} icon={Users} />
        <StatCard label="פעילים" value={active} tone="success" icon={ClipboardCheck} />
      </div>

      <section className="mt-6 space-y-3">
        <h2 className="text-sm font-semibold">הכיתות שלי</h2>
        {myClasses.length === 0 && <div className="text-sm text-muted-foreground">לא שובצת לכיתות עדיין.</div>}
        {myClasses.map((c) => (
          <article key={c.id} className="flex items-center justify-between rounded-2xl border border-border/60 bg-card/40 p-4">
            <div>
              <div className="text-base font-bold">{c.name}</div>
              <div className="text-xs text-muted-foreground">{c.schedule ?? "—"}</div>
            </div>
          </article>
        ))}
      </section>

      <section className="mt-6 space-y-3">
        <h2 className="text-sm font-semibold">התלמידים שלי</h2>
        {candidatesQ.isLoading && <div className="text-sm text-muted-foreground">טוען…</div>}
        {!candidatesQ.isLoading && candidates.length === 0 && <div className="text-sm text-muted-foreground">לא שויכו תלמידים.</div>}
        <div className="overflow-hidden rounded-2xl border border-border/60 bg-card/40">
          <table className="w-full text-sm">
            <thead className="bg-background/40 text-right text-[11px] uppercase tracking-wider text-muted-foreground">
              <tr><th className="px-3 py-2">שם</th><th className="px-3 py-2">טלפון</th><th className="px-3 py-2">סטטוס</th></tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {candidates.map((c) => (
                <tr key={c.id}>
                  <td className="px-3 py-3 font-semibold">{c.full_name}</td>
                  <td className="px-3 py-3 text-muted-foreground">{c.phone}</td>
                  <td className="px-3 py-3"><span className="rounded-full border border-gold/30 bg-gold/10 px-2 py-0.5 text-[10px] text-gold">{STATUS_LABELS[c.status] ?? c.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </AdminShell>
  );
}
