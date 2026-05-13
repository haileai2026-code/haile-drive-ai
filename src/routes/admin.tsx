import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AdminLoading, AdminShell, StatCard } from "@/components/AdminShell";
import { adminApi } from "@/lib/admin-api";
import { Users, GraduationCap, FileText, FileQuestion, UserCog, Building2 } from "lucide-react";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "דשבורד בעלים — Haile Drive AI" }] }),
  component: AdminOverview,
});

function AdminOverview() {
  const candidatesQ = useQuery({ queryKey: ["candidates"], queryFn: () => adminApi.listCandidates() });
  const classesQ = useQuery({ queryKey: ["classes"], queryFn: adminApi.listClasses });
  const teachersQ = useQuery({ queryKey: ["teachers"], queryFn: adminApi.listTeachers });
  const materialsQ = useQuery({ queryKey: ["materials"], queryFn: () => adminApi.listMaterials() });
  const examsQ = useQuery({ queryKey: ["exams"], queryFn: adminApi.listExams });

  const candidates = candidatesQ.data ?? [];
  const active = candidates.filter((c) => c.status === "active").length;
  const isLoading = candidatesQ.isLoading || classesQ.isLoading || teachersQ.isLoading || materialsQ.isLoading || examsQ.isLoading;

  return (
    <AdminShell title="דשבורד בעלים">
      <section className="mb-6 rounded-2xl border border-gold/30 bg-gradient-to-br from-amber-900/25 via-card/60 to-card/30 p-5 shadow-[var(--shadow-gold)]">
        <p className="text-xs font-semibold text-gold">ניהול מלא של Haile Drive AI</p>
        <h2 className="mt-1 text-2xl font-black tracking-tight">בעלים: תלמידים, מורים, חומרי לימוד ומבחנים</h2>
        <p className="mt-2 max-w-3xl text-sm text-muted-foreground">פעולות מהיר — כל פעולה כאן מעדכנת את מסד הנתונים בזמן אמת.</p>
      </section>

      {isLoading && <AdminLoading />}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard label="סה״כ לידים/תלמידים" value={candidates.length} hint={`${active} פעילים`} tone="gold" icon={Users} />
        <StatCard label="כיתות" value={classesQ.data?.length ?? 0} icon={GraduationCap} />
        <StatCard label="מורים" value={teachersQ.data?.length ?? 0} icon={UserCog} />
        <StatCard label="חומרים" value={materialsQ.data?.length ?? 0} icon={FileText} />
        <StatCard label="מבחנים" value={examsQ.data?.length ?? 0} icon={FileQuestion} />
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <QuickLink to="/admin/candidates" icon={Users} title="לידים ותלמידים" desc="הוסף, ערוך, שייך לכיתה" />
        <QuickLink to="/admin/teachers" icon={UserCog} title="מורים והרשאות" desc="הענק הרשאת מורה ושייך לכיתות" />
        <QuickLink to="/admin/classes" icon={GraduationCap} title="כיתות וקבוצות" desc="צור כיתות לפי עיר" />
        <QuickLink to="/admin/materials" icon={FileText} title="חומרי לימוד והעשרה" desc="העלה PDF, תמונות וקישורים" />
        <QuickLink to="/admin/exams" icon={FileQuestion} title="בנק מבחנים" desc="צור מבחני אמריקאיות" />
        <QuickLink to="/admin/cities" icon={Building2} title="ערים ומסלולים" desc="ניהול סניפי הלימוד" />
      </div>
    </AdminShell>
  );
}

function QuickLink({ to, icon: Icon, title, desc }: { to: string; icon: any; title: string; desc: string }) {
  return (
    <Link to={to} className="rounded-2xl border border-border/60 bg-card/40 p-4 transition hover:border-gold/40">
      <Icon className="h-5 w-5 text-gold" />
      <div className="mt-3 text-sm font-bold">{title}</div>
      <div className="text-xs text-muted-foreground">{desc}</div>
    </Link>
  );
}
