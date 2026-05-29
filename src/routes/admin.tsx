import { createFileRoute, Link, Outlet, useLocation } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AdminLoading, AdminShell, StatCard } from "@/components/AdminShell";
import { adminApi } from "@/lib/admin-api";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Users, GraduationCap, FileText, UserCog, Building2, Megaphone, X } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "דשבורד בעלים — Haile Drive AI" }] }),
  component: AdminOverview,
});

function AdminOverview() {
  const location = useLocation();
  if (location.pathname !== "/admin") return <Outlet />;
  return <AdminOverviewContent />;
}

function AdminOverviewContent() {
  const { user, loading } = useAuth();
  const canQuery = !loading && !!user;

  const candidatesQ = useQuery({ queryKey: ["candidates"], queryFn: () => adminApi.listCandidates(), enabled: canQuery });
  const classesQ = useQuery({ queryKey: ["classes"], queryFn: adminApi.listClasses, enabled: canQuery });
  const teachersQ = useQuery({ queryKey: ["teachers"], queryFn: adminApi.listTeachers, enabled: canQuery });
  const materialsQ = useQuery({ queryKey: ["materials"], queryFn: () => adminApi.listMaterials(), enabled: canQuery });
  const examsQ = useQuery({ queryKey: ["exams"], queryFn: adminApi.listExams, enabled: canQuery });
  const beqaQ = useQuery({
    queryKey: ["beqa-stats"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("beqa_diagnostic_sessions")
        .select("recommendation, final_beqa_score")
        .not("final_beqa_score", "is", null);
      if (error) throw error;
      return data ?? [];
    },
    enabled: canQuery,
  });

  const beqaStats = beqaQ.data ?? [];
  const beqaTotal = beqaStats.length;
  const gradeA = beqaStats.filter((s) => s.recommendation === "A").length;
  const gradeB = beqaStats.filter((s) => s.recommendation === "B").length;
  const gradeC = beqaStats.filter((s) => s.recommendation === "C").length;
  const avgScore = beqaTotal > 0
    ? (beqaStats.reduce((sum, s) => sum + Number(s.final_beqa_score ?? 0), 0) / beqaTotal).toFixed(1)
    : "0";

  const candidates = candidatesQ.data ?? [];
  const active = candidates.filter((c) => c.status === "active").length;
  const isLoading = candidatesQ.isLoading || classesQ.isLoading || teachersQ.isLoading || materialsQ.isLoading || examsQ.isLoading;

  const [announceOpen, setAnnounceOpen] = useState(false);
  const [content, setContent] = useState("");
  const [target, setTarget] = useState<string>(""); // "" = all
  const [posting, setPosting] = useState(false);

  const publish = async () => {
    if (!content.trim()) { toast.error("תוכן ההודעה חובה"); return; }
    if (content.length > 2000) { toast.error("מקסימום 2000 תווים"); return; }
    if (!user) { toast.error("נדרש להתחבר"); return; }
    setPosting(true);
    const { error } = await supabase.from("community_posts").insert({
      author_id: user.id,
      post_type: "announcement",
      class_id: target || null,
      content: content.trim(),
    });
    setPosting(false);
    if (error) { toast.error(error.message); return; }
    toast.success("ההודעה פורסמה בהצלחה");
    setContent(""); setTarget(""); setAnnounceOpen(false);
  };

  return (
    <AdminShell title="דשבורד בעלים">
      <section className="mb-6 rounded-2xl border border-gold/30 bg-gradient-to-br from-amber-900/25 via-card/60 to-card/30 p-5 shadow-[var(--shadow-gold)]">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <p className="text-xs font-semibold text-gold">ניהול מלא של Haile Drive AI</p>
            <h2 className="mt-1 text-2xl font-black tracking-tight">בעלים: תלמידים, מרצים, חומרי לימוד ומבחנים</h2>
            <p className="mt-2 max-w-3xl text-sm text-muted-foreground">פעולות מהיר — כל פעולה כאן מעדכנת את מסד הנתונים בזמן אמת.</p>
          </div>
          <button
            onClick={() => setAnnounceOpen(true)}
            className="inline-flex h-11 items-center gap-2 rounded-xl bg-gold px-5 text-sm font-bold text-gold-foreground shadow-[var(--shadow-gold)] hover:opacity-90"
          >
            <Megaphone className="h-4 w-4" /> 📢 פרסם הודעה לקהילה
          </button>
        </div>
      </section>

      {isLoading && <AdminLoading />}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard label="סה״כ לידים/תלמידים" value={candidates.length} hint={`${active} פעילים`} tone="gold" icon={Users} />
        <StatCard label="כיתות" value={classesQ.data?.length ?? 0} icon={GraduationCap} />
        <StatCard label="מרצים" value={teachersQ.data?.length ?? 0} icon={UserCog} />
        <StatCard label="חומרים" value={materialsQ.data?.length ?? 0} icon={FileText} />
        <StatCard label="מבחנים" value={examsQ.data?.length ?? 0} icon={FileText} />
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <QuickLink to="/admin/candidates" icon={Users} title="לידים ותלמידים" desc="הוסף, ערוך, שייך לכיתה" />
        <QuickLink to="/admin/teachers" icon={UserCog} title="מרצים והרשאות" desc="הענק הרשאת מרצה ושייך לכיתות" />
        <QuickLink to="/admin/organization" icon={GraduationCap} title="כיתות וקבוצות" desc="צור כיתות לפי עיר" />
        <QuickLink to="/admin/content" icon={FileText} title="📚 תוכן לימודי" desc="חומרי לימוד ובנק מבחנים" />
        <QuickLink to="/admin/organization" icon={Building2} title="ערים ומסלולים" desc="ניהול סניפי הלימוד" />
      </div>

      {announceOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4" onClick={() => setAnnounceOpen(false)}>
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-lg rounded-2xl border border-border bg-background p-5" dir="rtl">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold flex items-center gap-2"><Megaphone className="h-5 w-5 text-gold" /> פרסום הודעה לקהילה</h3>
              <button onClick={() => setAnnounceOpen(false)} className="rounded-md p-1 hover:bg-accent"><X className="h-4 w-4" /></button>
            </div>
            <div className="mt-4 space-y-3">
              <label className="block">
                <span className="mb-1 block text-xs font-semibold">יעד</span>
                <select value={target} onChange={(e) => setTarget(e.target.value)} className="block w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                  <option value="">כל הקהילה</option>
                  {classesQ.data?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="mb-1 flex items-center justify-between text-xs font-semibold">
                  <span>תוכן ההודעה *</span>
                  <span className="text-muted-foreground">{content.length}/2000</span>
                </span>
                <textarea
                  value={content}
                  maxLength={2000}
                  onChange={(e) => setContent(e.target.value)}
                  rows={6}
                  placeholder="כתוב כאן את ההודעה שתישלח לכל חברי הקהילה…"
                  className="block w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </label>
              <div className="flex justify-end gap-2 pt-2">
                <button onClick={() => setAnnounceOpen(false)} className="rounded-lg border border-border/60 px-4 py-2 text-sm">ביטול</button>
                <button onClick={publish} disabled={posting} className="inline-flex items-center gap-1.5 rounded-lg bg-gold px-4 py-2 text-sm font-semibold text-gold-foreground disabled:opacity-50">
                  <Megaphone className="h-4 w-4" /> {posting ? "מפרסם…" : "פרסם"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
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
