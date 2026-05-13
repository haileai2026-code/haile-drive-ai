import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AdminShell } from "@/components/AdminShell";
import {
  candidates, candidateStatusLabel, candidateStatusTone, cities, cityName,
  type CandidateStatus,
} from "@/lib/ops-data";
import { Search, Plus, Phone, Tag } from "lucide-react";

export const Route = createFileRoute("/admin/candidates")({
  head: () => ({ meta: [{ title: "Candidates CRM — Haile Drive AI" }] }),
  component: CandidatesCRM,
});

const STATUSES: (CandidateStatus | "all")[] = [
  "all", "new-lead", "contacted", "missing-docs", "waiting-opening", "assigned", "active", "completed",
];

function CandidatesCRM() {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<CandidateStatus | "all">("all");
  const [city, setCity] = useState<string>("all");

  const list = useMemo(
    () =>
      candidates.filter((c) => {
        if (status !== "all" && c.status !== status) return false;
        if (city !== "all" && c.cityId !== city) return false;
        if (q && !`${c.name} ${c.phone}`.toLowerCase().includes(q.toLowerCase())) return false;
        return true;
      }),
    [q, status, city],
  );

  return (
    <AdminShell title="Candidates CRM">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={q} onChange={(e) => setQ(e.target.value)}
            placeholder="Search name or phone…"
            className="h-10 w-full rounded-xl border border-input bg-background ps-9 pe-3 text-sm outline-none focus:ring-1 focus:ring-gold"
          />
        </div>
        <select value={city} onChange={(e) => setCity(e.target.value)} className="h-10 rounded-xl border border-input bg-background px-3 text-sm">
          <option value="all">All cities</option>
          {cities.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value as CandidateStatus | "all")} className="h-10 rounded-xl border border-input bg-background px-3 text-sm capitalize">
          {STATUSES.map((s) => <option key={s} value={s}>{s === "all" ? "All statuses" : candidateStatusLabel[s]}</option>)}
        </select>
        <button className="ms-auto inline-flex h-10 items-center gap-1.5 rounded-xl bg-gold px-4 text-sm font-semibold text-gold-foreground hover:opacity-90">
          <Plus className="h-4 w-4" /> New candidate
        </button>
      </div>

      {/* Pipeline strip */}
      <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
        {STATUSES.filter((s) => s !== "all").map((s) => {
          const count = candidates.filter((c) => c.status === s).length;
          return (
            <button
              key={s}
              onClick={() => setStatus(s as CandidateStatus)}
              className={`shrink-0 rounded-xl border px-3 py-2 text-left text-xs ${candidateStatusTone[s as CandidateStatus]}`}
            >
              <div className="text-[10px] uppercase tracking-wider opacity-80">{candidateStatusLabel[s as CandidateStatus]}</div>
              <div className="text-base font-bold">{count}</div>
            </button>
          );
        })}
      </div>

      {/* Table */}
      <div className="mt-4 overflow-hidden rounded-2xl border border-border/60 bg-card/40">
        <table className="w-full text-sm">
          <thead className="bg-background/40 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">Phone</th>
              <th className="px-3 py-2">City</th>
              <th className="px-3 py-2">Language</th>
              <th className="px-3 py-2">Tags</th>
              <th className="px-3 py-2">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {list.map((c) => (
              <tr key={c.id} className="hover:bg-accent/30">
                <td className="px-3 py-3">
                  <div className="font-semibold">{c.name}</div>
                  {c.notes && <div className="text-[11px] text-muted-foreground">{c.notes}</div>}
                </td>
                <td className="px-3 py-3 text-muted-foreground"><span className="inline-flex items-center gap-1"><Phone className="h-3 w-3" />{c.phone}</span></td>
                <td className="px-3 py-3 text-muted-foreground">{cityName(c.cityId)}</td>
                <td className="px-3 py-3 text-muted-foreground">{c.language}</td>
                <td className="px-3 py-3">
                  <span className="inline-flex flex-wrap gap-1">
                    {c.tags.map((t) => (
                      <span key={t} className="inline-flex items-center gap-1 rounded-full border border-border/60 px-2 py-0.5 text-[10px]">
                        <Tag className="h-2.5 w-2.5" />{t}
                      </span>
                    ))}
                  </span>
                </td>
                <td className="px-3 py-3">
                  <span className={`rounded-full border px-2 py-0.5 text-[10px] ${candidateStatusTone[c.status]}`}>
                    {candidateStatusLabel[c.status]}
                  </span>
                </td>
              </tr>
            ))}
            {list.length === 0 && (
              <tr><td colSpan={6} className="px-3 py-10 text-center text-sm text-muted-foreground">No matches.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </AdminShell>
  );
}
