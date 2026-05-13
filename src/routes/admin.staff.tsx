import { createFileRoute } from "@tanstack/react-router";
import { AdminShell } from "@/components/AdminShell";
import { staff, cities, cityName } from "@/lib/ops-data";
import { Plus, Shield } from "lucide-react";

export const Route = createFileRoute("/admin/staff")({
  head: () => ({ meta: [{ title: "Staff & Permissions — Haile Drive AI" }] }),
  component: StaffPage,
});

const ALL_PERMS = ["candidates", "attendance", "classes", "lessons", "makeup", "notifications", "staff"];

function StaffPage() {
  return (
    <AdminShell title="Staff & Permissions">
      <div className="flex justify-end">
        <button className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-gold px-4 text-sm font-semibold text-gold-foreground"><Plus className="h-4 w-4" /> Invite staff</button>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {staff.map((s) => (
          <article key={s.id} className="rounded-2xl border border-border/60 bg-card/40 p-4">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="grid h-9 w-9 place-items-center rounded-full bg-gold/15 text-gold font-bold">{s.name[0]}</span>
                  <div>
                    <div className="text-sm font-bold">{s.name}</div>
                    <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{s.role}</div>
                  </div>
                </div>
              </div>
              <Shield className="h-4 w-4 text-gold" />
            </div>

            <div className="mt-4">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Cities</div>
              <div className="mt-1 flex flex-wrap gap-1">
                {(s.cityIds.length === cities.length ? ["All cities"] : s.cityIds.map(cityName)).map((n) => (
                  <span key={n} className="rounded-full border border-border/60 px-2 py-0.5 text-[10px]">{n}</span>
                ))}
              </div>
            </div>

            <div className="mt-3">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Permissions</div>
              <div className="mt-1 grid grid-cols-2 gap-1.5">
                {ALL_PERMS.map((p) => {
                  const has = s.permissions.includes("*") || s.permissions.includes(p);
                  return (
                    <label key={p} className="flex items-center gap-2 rounded-lg border border-border/40 bg-background/40 px-2 py-1.5 text-xs">
                      <input type="checkbox" defaultChecked={has} disabled={s.role === "owner"} className="accent-gold" />
                      <span className="capitalize">{p}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          </article>
        ))}
      </div>
    </AdminShell>
  );
}
