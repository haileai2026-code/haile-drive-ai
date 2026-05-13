import { createFileRoute } from "@tanstack/react-router";
import { AdminShell } from "@/components/AdminShell";
import { cities, programs, classes, cityName } from "@/lib/ops-data";
import { Building2, Plus } from "lucide-react";

export const Route = createFileRoute("/admin/cities")({
  head: () => ({ meta: [{ title: "Cities & Programs — Haile Drive AI" }] }),
  component: CitiesPage,
});

function CitiesPage() {
  return (
    <AdminShell title="Cities & Programs">
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-2xl border border-border/60 bg-card/40 p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold flex items-center gap-2"><Building2 className="h-4 w-4 text-gold" /> Cities</h2>
            <button className="inline-flex h-8 items-center gap-1 rounded-lg bg-gold px-3 text-xs font-semibold text-gold-foreground"><Plus className="h-3 w-3" /> Add</button>
          </div>
          <ul className="divide-y divide-border/40">
            {cities.map((c) => {
              const cnt = classes.filter((cl) => cl.cityId === c.id).length;
              return (
                <li key={c.id} className="flex items-center justify-between py-2.5">
                  <span className="font-medium">{c.name}</span>
                  <span className="text-xs text-muted-foreground">{cnt} classes</span>
                </li>
              );
            })}
          </ul>
        </section>

        <section className="rounded-2xl border border-border/60 bg-card/40 p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Training programs</h2>
            <button className="inline-flex h-8 items-center gap-1 rounded-lg bg-gold px-3 text-xs font-semibold text-gold-foreground"><Plus className="h-3 w-3" /> Add</button>
          </div>
          <ul className="space-y-2">
            {programs.map((p) => (
              <li key={p.id} className="rounded-xl border border-border/40 bg-background/40 p-3">
                <div className="text-sm font-semibold">{p.name}</div>
                <div className="mt-1 flex flex-wrap gap-1">
                  {p.cityIds.map((id) => (
                    <span key={id} className="rounded-full border border-border/60 px-2 py-0.5 text-[10px]">{cityName(id)}</span>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </AdminShell>
  );
}
