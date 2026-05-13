import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AdminShell } from "@/components/AdminShell";
import { useStore } from "@/lib/data-store";
import { exportRows } from "@/lib/import-export";
import {
  classes, attendanceToday, candidateStatusLabel, cityName, className as clsName,
} from "@/lib/ops-data";
import { Download, FileSpreadsheet, FileText } from "lucide-react";

export const Route = createFileRoute("/admin/export")({
  head: () => ({ meta: [{ title: "Export Data — Haile Drive AI" }] }),
  component: ExportPage,
});

type Dataset = "students" | "attendance" | "classes" | "progress";

function ExportPage() {
  const { candidates, cities } = useStore();
  const [dataset, setDataset] = useState<Dataset>("students");
  const [format, setFormat] = useState<"xlsx" | "csv">("xlsx");
  const [city, setCity] = useState("all");
  const [status, setStatus] = useState("all");
  const [classId, setClassId] = useState("all");

  const rows = useMemo(() => {
    if (dataset === "students") {
      return candidates
        .filter((c) => city === "all" || c.cityId === city)
        .filter((c) => status === "all" || c.status === status)
        .map((c) => ({
          name: c.name, phone: c.phone, city: cityName(c.cityId),
          language: c.language, status: candidateStatusLabel[c.status],
          class: c.classId ? clsName(c.classId) : "", tags: c.tags.join(", "),
          notes: c.notes ?? "", createdAt: c.createdAt,
        }));
    }
    if (dataset === "attendance") {
      return attendanceToday
        .filter((a) => classId === "all" || a.classId === classId)
        .map((a) => ({
          date: a.date, class: clsName(a.classId), studentId: a.studentId,
          lessonId: a.lessonId, mark: a.mark,
        }));
    }
    if (dataset === "classes") {
      return classes
        .filter((c) => city === "all" || c.cityId === city)
        .map((c) => ({
          name: c.name, city: cityName(c.cityId), level: c.level,
          schedule: c.schedule, students: c.studentIds.length, capacity: c.capacity,
        }));
    }
    // progress (mock)
    return candidates
      .filter((c) => c.status === "active" || c.status === "completed")
      .map((c) => ({
        name: c.name, phone: c.phone, city: cityName(c.cityId),
        status: candidateStatusLabel[c.status],
        progressPct: c.status === "completed" ? 100 : Math.floor(40 + Math.random() * 50),
      }));
  }, [dataset, candidates, city, status, classId]);

  const doExport = () => {
    if (rows.length === 0) return;
    exportRows(rows, `haile-${dataset}-${new Date().toISOString().slice(0, 10)}`, format);
  };

  return (
    <AdminShell title="Export Data">
      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
        <aside className="space-y-2 rounded-2xl border border-border/60 bg-card/40 p-4">
          <h3 className="text-sm font-semibold">Dataset</h3>
          {([
            ["students", "All students"],
            ["attendance", "Attendance report"],
            ["classes", "Classes summary"],
            ["progress", "Progress report"],
          ] as [Dataset, string][]).map(([id, label]) => (
            <button
              key={id} onClick={() => setDataset(id)}
              className={`flex w-full items-center gap-2 rounded-xl border px-3 py-2 text-sm ${
                dataset === id ? "border-gold/40 bg-gold/10 text-gold" : "border-border/60 hover:bg-accent"
              }`}
            >
              <FileText className="h-4 w-4" /> {label}
            </button>
          ))}
        </aside>

        <section className="rounded-2xl border border-border/60 bg-card/40 p-4">
          <h3 className="text-sm font-semibold">Filters & format</h3>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {(dataset === "students" || dataset === "classes" || dataset === "progress") && (
              <select value={city} onChange={(e) => setCity(e.target.value)} className="h-10 rounded-xl border border-input bg-background px-3 text-sm">
                <option value="all">All cities</option>
                {cities.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            )}
            {dataset === "students" && (
              <select value={status} onChange={(e) => setStatus(e.target.value)} className="h-10 rounded-xl border border-input bg-background px-3 text-sm">
                <option value="all">All statuses</option>
                {Object.entries(candidateStatusLabel).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            )}
            {dataset === "attendance" && (
              <select value={classId} onChange={(e) => setClassId(e.target.value)} className="h-10 rounded-xl border border-input bg-background px-3 text-sm">
                <option value="all">All classes</option>
                {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            )}
            <select value={format} onChange={(e) => setFormat(e.target.value as "xlsx" | "csv")} className="h-10 rounded-xl border border-input bg-background px-3 text-sm">
              <option value="xlsx">Excel (.xlsx)</option>
              <option value="csv">CSV (.csv)</option>
            </select>
          </div>

          <div className="mt-4 flex items-center justify-between rounded-xl border border-border/40 bg-background/40 p-3 text-sm">
            <span className="flex items-center gap-2"><FileSpreadsheet className="h-4 w-4 text-gold" /> {rows.length} row{rows.length === 1 ? "" : "s"} ready</span>
            <button
              onClick={doExport} disabled={rows.length === 0}
              className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-gold px-4 text-sm font-semibold text-gold-foreground disabled:opacity-50"
            >
              <Download className="h-4 w-4" /> Export
            </button>
          </div>

          <div className="mt-4 overflow-x-auto rounded-xl border border-border/40">
            <table className="w-full text-sm">
              <thead className="bg-background/40 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                <tr>{rows[0] && Object.keys(rows[0]).map((k) => <th key={k} className="px-3 py-2">{k}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {rows.slice(0, 10).map((r, i) => (
                  <tr key={i}>
                    {Object.values(r).map((v, j) => <td key={j} className="px-3 py-2">{String(v)}</td>)}
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr><td className="px-3 py-6 text-center text-muted-foreground">No data matches your filters.</td></tr>
                )}
              </tbody>
            </table>
            {rows.length > 10 && (
              <div className="border-t border-border/40 p-2 text-center text-xs text-muted-foreground">
                Preview of first 10 of {rows.length} rows.
              </div>
            )}
          </div>
        </section>
      </div>
    </AdminShell>
  );
}
