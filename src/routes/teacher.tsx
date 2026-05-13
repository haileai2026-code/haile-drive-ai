import { createFileRoute, Link } from "@tanstack/react-router";
import { AdminShell, StatCard } from "@/components/AdminShell";
import { classes, attendanceToday, teacherName } from "@/lib/ops-data";
import { ClipboardCheck, Users, BookOpen } from "lucide-react";

export const Route = createFileRoute("/teacher")({
  head: () => ({ meta: [{ title: "Teacher — Haile Drive AI" }] }),
  component: TeacherDashboard,
});

function TeacherDashboard() {
  // Simulate: teacher u-tch-1
  const myClasses = classes.filter((c) => c.teacherId === "u-tch-1");
  const myStudents = myClasses.reduce((s, c) => s + c.studentIds.length, 0);
  const missing = attendanceToday.filter((a) => myClasses.some((c) => c.id === a.classId) && a.mark === "missing").length;

  return (
    <AdminShell title={`Welcome, ${teacherName("u-tch-1")}`}>
      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="My classes today" value={myClasses.length} tone="gold" icon={BookOpen} />
        <StatCard label="My students" value={myStudents} icon={Users} />
        <StatCard label="Missing today" value={missing} tone="warn" icon={ClipboardCheck} />
      </div>

      <section className="mt-6 space-y-3">
        <h2 className="text-sm font-semibold">Today's classes</h2>
        {myClasses.map((c) => (
          <article key={c.id} className="flex items-center justify-between rounded-2xl border border-border/60 bg-card/40 p-4">
            <div>
              <div className="text-base font-bold">{c.name}</div>
              <div className="text-xs text-muted-foreground">{c.schedule} · {c.studentIds.length} students</div>
            </div>
            <Link
              to="/teacher/attendance"
              search={{ classId: c.id }}
              className="rounded-lg bg-gold px-4 py-2 text-xs font-semibold text-gold-foreground"
            >
              Mark attendance
            </Link>
          </article>
        ))}
      </section>
    </AdminShell>
  );
}
