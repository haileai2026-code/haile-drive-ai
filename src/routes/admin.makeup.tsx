import { createFileRoute } from "@tanstack/react-router";
import { AdminShell, StatCard } from "@/components/AdminShell";
import { classes, makeupQueue, className as clsName } from "@/lib/ops-data";
import { Calendar, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/admin/makeup")({
  head: () => ({ meta: [{ title: "Makeup Queue — Haile Drive AI" }] }),
  component: MakeupPage,
});

function MakeupPage() {
  const counts = makeupQueue.reduce<Record<string, number>>((a, m) => ({ ...a, [m.status]: (a[m.status] ?? 0) + 1 }), {});
  return (
    <AdminShell title="Makeup Lesson Management">
      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Pending" value={counts.pending ?? 0} tone="warn" icon={Calendar} />
        <StatCard label="Scheduled" value={counts.scheduled ?? 0} tone="gold" icon={Calendar} />
        <StatCard label="Completed" value={counts.completed ?? 0} tone="success" icon={Calendar} />
      </div>

      <section className="mt-6 overflow-hidden rounded-2xl border border-border/60 bg-card/40">
        <header className="border-b border-border/40 px-4 py-3">
          <h3 className="text-sm font-semibold">Reassignment queue</h3>
          <p className="text-xs text-muted-foreground">Match students who missed a lesson to an open class.</p>
        </header>
        <ul className="divide-y divide-border/40">
          {makeupQueue.map((m) => (
            <li key={m.id} className="grid grid-cols-1 gap-2 px-4 py-3 md:grid-cols-[1fr_auto_1fr_auto] md:items-center">
              <div>
                <div className="text-sm font-semibold">Student {m.studentId.replace("s-", "#")}</div>
                <div className="text-[11px] text-muted-foreground">Missed: {clsName(m.missedClassId)}</div>
              </div>
              <ArrowRight className="hidden h-4 w-4 text-muted-foreground md:block rtl:rotate-180" />
              <select
                defaultValue={m.proposedClassId ?? ""}
                disabled={m.status === "completed"}
                className="h-9 rounded-lg border border-input bg-background px-2 text-xs disabled:opacity-50"
              >
                <option value="">Select makeup class…</option>
                {classes.filter((c) => c.id !== m.missedClassId).map((c) => (
                  <option key={c.id} value={c.id}>{c.name} · {c.schedule}</option>
                ))}
              </select>
              <div className="flex items-center gap-2">
                <span className={`rounded-full border px-2 py-0.5 text-[10px] capitalize ${
                  m.status === "completed" ? "border-emerald-500/40 text-emerald-300"
                  : m.status === "scheduled" ? "border-gold/40 text-gold"
                  : "border-amber-500/40 text-amber-300"
                }`}>{m.status}</span>
                {m.status !== "completed" && (
                  <button className="rounded-lg bg-gold px-3 py-1.5 text-xs font-semibold text-gold-foreground">Confirm</button>
                )}
              </div>
            </li>
          ))}
        </ul>
      </section>
    </AdminShell>
  );
}
