import { createFileRoute, Link } from "@tanstack/react-router";
import { AdminShell, StatCard } from "@/components/AdminShell";
import {
  attendanceToday, candidates, candidateStatusLabel, candidateStatusTone,
  classes, makeupQueue, notifications, teacherName, className as clsName,
} from "@/lib/ops-data";
import { Users, GraduationCap, AlertTriangle, Calendar, TrendingUp, Bell } from "lucide-react";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "Operations — Haile Drive AI" }] }),
  component: AdminOverview,
});

function AdminOverview() {
  const activeStudents = candidates.filter((c) => c.status === "active").length;
  const missingToday = attendanceToday.filter((a) => a.mark === "missing").length;
  const makeupPending = makeupQueue.filter((m) => m.status !== "completed").length;
  const pipeline = candidates.filter((c) => !["active", "completed", "failed", "inactive"].includes(c.status));
  const unread = notifications.filter((n) => !n.read).length;

  return (
    <AdminShell title="Operations Overview">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Active students" value={activeStudents + 22} hint="+3 this week" tone="gold" icon={Users} />
        <StatCard label="Today's classes" value={classes.length} hint="3 cities" icon={GraduationCap} />
        <StatCard label="Missing today" value={missingToday} hint="Trigger makeup flow" tone="warn" icon={AlertTriangle} />
        <StatCard label="Makeup pending" value={makeupPending} hint="Reassign to open class" tone="danger" icon={Calendar} />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        {/* Today's classes */}
        <section className="rounded-2xl border border-border/60 bg-card/40 p-4 lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Today's classes</h2>
            <Link to="/admin/classes" className="text-xs text-gold">View all →</Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                <tr><th className="pb-2">Class</th><th className="pb-2">Teacher</th><th className="pb-2">Schedule</th><th className="pb-2 text-right">Capacity</th></tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {classes.map((c) => (
                  <tr key={c.id}>
                    <td className="py-2.5 font-medium">{c.name}</td>
                    <td className="py-2.5 text-muted-foreground">{teacherName(c.teacherId)}</td>
                    <td className="py-2.5 text-muted-foreground">{c.schedule}</td>
                    <td className="py-2.5 text-right">
                      <span className="rounded-full border border-border/60 px-2 py-0.5 text-xs">{c.studentIds.length}/{c.capacity}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Notifications */}
        <section className="rounded-2xl border border-border/60 bg-card/40 p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Notifications</h2>
            <span className="rounded-full bg-gold/15 px-2 py-0.5 text-[10px] font-bold text-gold">{unread} new</span>
          </div>
          <ul className="space-y-2">
            {notifications.slice(0, 4).map((n) => (
              <li key={n.id} className="flex gap-2 rounded-xl border border-border/40 bg-background/40 p-2.5">
                <Bell className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gold" />
                <div className="min-w-0">
                  <div className="truncate text-xs font-semibold">{n.title}</div>
                  <div className="truncate text-[11px] text-muted-foreground">{n.body}</div>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>

      {/* Candidate pipeline */}
      <section className="mt-6 rounded-2xl border border-border/60 bg-card/40 p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold">Candidate pipeline</h2>
          <Link to="/admin/candidates" className="text-xs text-gold">Open CRM →</Link>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {pipeline.map((c) => (
            <div key={c.id} className="rounded-xl border border-border/40 bg-background/40 p-3">
              <div className="flex items-center justify-between">
                <div className="truncate text-sm font-semibold">{c.name}</div>
                <span className={`rounded-full border px-2 py-0.5 text-[10px] ${candidateStatusTone[c.status]}`}>
                  {candidateStatusLabel[c.status]}
                </span>
              </div>
              <div className="mt-1 text-[11px] text-muted-foreground">{c.phone} · {c.language}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Makeup queue snapshot */}
      <section className="mt-6 rounded-2xl border border-border/60 bg-card/40 p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold flex items-center gap-2"><TrendingUp className="h-4 w-4 text-gold" /> Makeup queue</h2>
          <Link to="/admin/makeup" className="text-xs text-gold">Manage →</Link>
        </div>
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {makeupQueue.map((m) => (
            <li key={m.id} className="rounded-xl border border-border/40 bg-background/40 p-3">
              <div className="text-sm font-semibold">Student {m.studentId.replace("s-", "#")}</div>
              <div className="text-[11px] text-muted-foreground">Missed: {clsName(m.missedClassId)}</div>
              <div className="mt-2 inline-flex rounded-full border border-border/60 px-2 py-0.5 text-[10px] capitalize">{m.status}</div>
            </li>
          ))}
        </ul>
      </section>
    </AdminShell>
  );
}
