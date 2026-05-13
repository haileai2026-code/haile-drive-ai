import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AdminShell } from "@/components/AdminShell";
import { classes, type AttendanceMark } from "@/lib/ops-data";
import { CheckCircle2, Clock, XCircle, RotateCcw } from "lucide-react";

type Search = { classId?: string };

export const Route = createFileRoute("/teacher/attendance")({
  validateSearch: (s: Record<string, unknown>): Search => ({ classId: typeof s.classId === "string" ? s.classId : undefined }),
  head: () => ({ meta: [{ title: "Mark Attendance — Haile Drive AI" }] }),
  component: MarkAttendance,
});

const MARKS: { key: AttendanceMark; label: string; icon: typeof CheckCircle2; cls: string }[] = [
  { key: "present", label: "Present", icon: CheckCircle2, cls: "border-emerald-500/40 text-emerald-300 bg-emerald-500/10" },
  { key: "late", label: "Late", icon: Clock, cls: "border-amber-500/40 text-amber-300 bg-amber-500/10" },
  { key: "missing", label: "Missing", icon: XCircle, cls: "border-rose-500/40 text-rose-300 bg-rose-500/10" },
  { key: "makeup-completed", label: "Makeup", icon: RotateCcw, cls: "border-sky-500/40 text-sky-300 bg-sky-500/10" },
];

function MarkAttendance() {
  const { classId } = Route.useSearch();
  const cls = classes.find((c) => c.id === classId) ?? classes[0];
  const [marks, setMarks] = useState<Record<string, AttendanceMark>>({});

  const set = (sid: string, m: AttendanceMark) => setMarks((p) => ({ ...p, [sid]: m }));
  const counts = MARKS.map((m) => ({ ...m, n: Object.values(marks).filter((x) => x === m.key).length }));

  return (
    <AdminShell title={`Attendance — ${cls.name}`}>
      <div className="rounded-2xl border border-gold/30 bg-gradient-to-br from-amber-900/30 to-card p-4">
        <div className="text-[11px] uppercase tracking-wider text-gold/80">{cls.schedule}</div>
        <div className="mt-1 text-base font-bold">{cls.studentIds.length} students enrolled</div>
        <div className="mt-3 flex flex-wrap gap-2">
          {counts.map((c) => (
            <span key={c.key} className={`rounded-full border px-2 py-0.5 text-[11px] ${c.cls}`}>{c.label}: {c.n}</span>
          ))}
        </div>
      </div>

      <ul className="mt-4 space-y-2">
        {cls.studentIds.map((sid) => {
          const current = marks[sid];
          return (
            <li key={sid} className="rounded-2xl border border-border/60 bg-card/40 p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="grid h-9 w-9 place-items-center rounded-full bg-background/60 font-bold">{sid.replace("s-", "")}</span>
                  <span className="text-sm font-semibold">Student #{sid.replace("s-", "")}</span>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-4 gap-1.5">
                {MARKS.map(({ key, label, icon: Icon, cls: tone }) => (
                  <button
                    key={key}
                    onClick={() => set(sid, key)}
                    className={`flex flex-col items-center gap-1 rounded-lg border px-2 py-2 text-[11px] transition ${
                      current === key ? tone : "border-border/50 text-muted-foreground hover:border-gold/30"
                    }`}
                  >
                    <Icon className="h-4 w-4" /> {label}
                  </button>
                ))}
              </div>
            </li>
          );
        })}
      </ul>

      <div className="sticky bottom-4 mt-6">
        <button className="w-full rounded-xl bg-gold py-3 text-sm font-bold text-gold-foreground shadow-[var(--shadow-gold)]">
          Save attendance
        </button>
      </div>
    </AdminShell>
  );
}
