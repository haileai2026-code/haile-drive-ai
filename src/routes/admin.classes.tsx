import { createFileRoute } from "@tanstack/react-router";
import { AdminShell } from "@/components/AdminShell";
import { classes, cityName, programName, teacherName } from "@/lib/ops-data";
import { Plus, Users, Calendar } from "lucide-react";

export const Route = createFileRoute("/admin/classes")({
  head: () => ({ meta: [{ title: "Classes — Haile Drive AI" }] }),
  component: ClassesPage,
});

function ClassesPage() {
  return (
    <AdminShell title="Class Management">
      <div className="flex justify-end">
        <button className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-gold px-4 text-sm font-semibold text-gold-foreground">
          <Plus className="h-4 w-4" /> New class
        </button>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {classes.map((c) => {
          const fill = Math.round((c.studentIds.length / c.capacity) * 100);
          return (
            <article key={c.id} className="rounded-2xl border border-border/60 bg-card/40 p-4">
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{cityName(c.cityId)} · {programName(c.programId)}</div>
                  <h3 className="mt-1 text-base font-bold">{c.name}</h3>
                </div>
                <span className="rounded-full border border-gold/30 bg-gold/10 px-2 py-0.5 text-[10px] capitalize text-gold">{c.level}</span>
              </div>

              <div className="mt-4 space-y-2 text-sm">
                <div className="flex items-center gap-2 text-muted-foreground"><Calendar className="h-3.5 w-3.5" />{c.schedule}</div>
                <div className="flex items-center gap-2 text-muted-foreground"><Users className="h-3.5 w-3.5" />{teacherName(c.teacherId)}</div>
              </div>

              <div className="mt-4">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Capacity</span>
                  <span className="font-semibold">{c.studentIds.length}/{c.capacity}</span>
                </div>
                <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-background/60">
                  <div className="h-full rounded-full bg-gradient-to-r from-gold to-amber-500" style={{ width: `${fill}%` }} />
                </div>
              </div>

              <div className="mt-4 flex gap-2">
                <button className="flex-1 rounded-lg border border-border/60 bg-background/40 py-2 text-xs">Roster</button>
                <button className="flex-1 rounded-lg bg-gold/15 py-2 text-xs font-semibold text-gold">Open</button>
              </div>
            </article>
          );
        })}
      </div>
    </AdminShell>
  );
}
