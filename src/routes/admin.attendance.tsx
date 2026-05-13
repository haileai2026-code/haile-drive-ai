import { createFileRoute } from "@tanstack/react-router";
import { AdminShell, StatCard } from "@/components/AdminShell";
import { attendanceToday, classes, className as clsName } from "@/lib/ops-data";
import { CheckCircle2, Clock, XCircle, RotateCcw } from "lucide-react";

export const Route = createFileRoute("/admin/attendance")({
  head: () => ({ meta: [{ title: "Attendance — Haile Drive AI" }] }),
  component: AttendancePage,
});

const ICON = { present: CheckCircle2, late: Clock, missing: XCircle, "makeup-completed": RotateCcw };
const TONE = {
  present: "text-emerald-300", late: "text-amber-300",
  missing: "text-rose-300", "makeup-completed": "text-sky-300",
};

function AttendancePage() {
  const summary = attendanceToday.reduce<Record<string, number>>((acc, r) => {
    acc[r.mark] = (acc[r.mark] ?? 0) + 1; return acc;
  }, {});
  const total = attendanceToday.length;
  const pct = total ? Math.round(((summary.present ?? 0) / total) * 100) : 0;

  return (
    <AdminShell title="Attendance">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Attendance rate" value={`${pct}%`} hint="Today across all classes" tone="gold" />
        <StatCard label="Present" value={summary.present ?? 0} tone="success" />
        <StatCard label="Late" value={summary.late ?? 0} tone="warn" />
        <StatCard label="Missing" value={summary.missing ?? 0} tone="danger" />
      </div>

      <section className="mt-6 space-y-4">
        {classes.map((c) => {
          const rows = attendanceToday.filter((a) => a.classId === c.id);
          if (rows.length === 0) return null;
          return (
            <div key={c.id} className="overflow-hidden rounded-2xl border border-border/60 bg-card/40">
              <header className="flex items-center justify-between border-b border-border/40 px-4 py-3">
                <h3 className="text-sm font-semibold">{c.name}</h3>
                <span className="text-xs text-muted-foreground">{rows.length} marked</span>
              </header>
              <ul className="divide-y divide-border/40">
                {rows.map((r) => {
                  const Icon = ICON[r.mark];
                  return (
                    <li key={r.id} className="flex items-center justify-between px-4 py-2.5">
                      <div className="text-sm font-medium">Student {r.studentId.replace("s-", "#")}</div>
                      <div className={`inline-flex items-center gap-1.5 text-xs ${TONE[r.mark]}`}>
                        <Icon className="h-4 w-4" />
                        <span className="capitalize">{r.mark.replace("-", " ")}</span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </section>
    </AdminShell>
  );
}
