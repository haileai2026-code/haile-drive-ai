import { createFileRoute, Link, Outlet, useLocation } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AdminLoading, AdminShell } from "@/components/AdminShell";
import { adminApi, type Exam } from "@/lib/admin-api";
import { useAuth } from "@/lib/auth";
import { Plus, Trash2, FileQuestion, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/exams")({
  head: () => ({ meta: [{ title: "מבחנים — Haile Drive AI" }] }),
  component: ExamsPage,
});

function ExamsPage() {
  const location = useLocation();
  if (location.pathname !== "/admin/exams") return <Outlet />;

  return (
    <AdminShell title="בנק מבחנים">
      <ExamsListPanel />
    </AdminShell>
  );
}

export function ExamsListPanel() {
  const qc = useQueryClient();
  const { user, loading } = useAuth();
  const canQuery = !loading && !!user;
  const examsQ = useQuery({ queryKey: ["exams"], queryFn: adminApi.listExams, enabled: canQuery });
  const classesQ = useQuery({ queryKey: ["classes"], queryFn: adminApi.listClasses, enabled: canQuery });
  const [editing, setEditing] = useState<Partial<Exam> | null>(null);

  const saveMut = useMutation({
    mutationFn: (e: Partial<Exam>) => adminApi.upsertExam(e as any),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["exams"] }); setEditing(null); toast.success("נשמר"); },
    onError: (e: any) => toast.error(e.message),
  });
  const delMut = useMutation({
    mutationFn: (id: string) => adminApi.deleteExam(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["exams"] }); toast.success("נמחק"); },
    onError: (e: any) => toast.error(e.message),
  });

  const className = (id: string | null) => classesQ.data?.find((c) => c.id === id)?.name ?? "כל הכיתות";
  const isLoading = examsQ.isLoading || classesQ.isLoading;
  const loadError = examsQ.error || classesQ.error;

  return (
    <>
      <div className="flex justify-end">
        <button onClick={() => setEditing({ title: "", is_published: false })} className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-gold px-4 text-sm font-semibold text-gold-foreground">
          <Plus className="h-4 w-4" /> מבחן חדש
        </button>
      </div>

      {isLoading && <div className="mt-4"><AdminLoading label="טוען מבחנים וכיתות מהמסד…" /></div>}
      {loadError && <div className="mt-4 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-300">טעינת הנתונים נכשלה: {(loadError as Error).message}</div>}

      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {!isLoading && examsQ.data?.length === 0 && <div className="text-sm text-muted-foreground">אין מבחנים. צור מבחן ראשון.</div>}
        {examsQ.data?.map((e) => (
          <article key={e.id} className="rounded-2xl border border-border/60 bg-card/40 p-4">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-gold/15 text-gold"><FileQuestion className="h-5 w-5" /></div>
                <div>
                  <h3 className="text-base font-bold">{e.title}</h3>
                  <div className="mt-1 text-xs text-muted-foreground">{className(e.class_id)}</div>
                </div>
              </div>
              <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] ${e.is_published ? "bg-emerald-500/15 text-emerald-300" : "border border-border/60 text-muted-foreground"}`}>
                {e.is_published ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                {e.is_published ? "פורסם" : "טיוטה"}
              </span>
            </div>
            {e.description && <p className="mt-2 text-xs text-muted-foreground">{e.description}</p>}
            <div className="mt-4 flex gap-2">
              <Link to="/admin/exams/$examId" params={{ examId: e.id }} className="flex-1 rounded-lg bg-gold/15 py-2 text-center text-xs font-semibold text-gold">ערוך שאלות</Link>
              <button onClick={() => setEditing(e)} className="rounded-lg border border-border/60 px-3 py-2 text-xs">פרטים</button>
              <button onClick={() => { if (confirm("למחוק?")) delMut.mutate(e.id); }} className="rounded-lg border border-rose-500/30 px-3 py-2 text-xs text-rose-400"><Trash2 className="h-3.5 w-3.5" /></button>
            </div>
          </article>
        ))}
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4" onClick={() => setEditing(null)}>
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md rounded-2xl border border-border bg-background p-5" dir="rtl">
            <h3 className="mb-4 text-lg font-bold">{editing.id ? "עריכת מבחן" : "מבחן חדש"}</h3>
            <form onSubmit={(e) => { e.preventDefault(); if (!editing.title?.trim()) { toast.error("כותרת חובה"); return; } saveMut.mutate(editing); }} className="space-y-3">
              <label className="block">
                <span className="mb-1 block text-xs font-semibold">כותרת *</span>
                <input required value={editing.title ?? ""} onChange={(e) => setEditing({ ...editing, title: e.target.value })} className="block w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-semibold">תיאור</span>
                <textarea value={editing.description ?? ""} onChange={(e) => setEditing({ ...editing, description: e.target.value })} className="block w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-semibold">משויך לכיתה</span>
                <select value={editing.class_id ?? ""} onChange={(e) => setEditing({ ...editing, class_id: e.target.value || null })} className="block w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                  <option value="">— לכל הכיתות —</option>
                  {classesQ.data?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={!!editing.is_published} onChange={(e) => setEditing({ ...editing, is_published: e.target.checked })} />
                <span className="text-sm">פרסם לתלמידים</span>
              </label>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setEditing(null)} className="rounded-lg border border-border/60 px-4 py-2 text-sm">ביטול</button>
                <button type="submit" disabled={saveMut.isPending} className="rounded-lg bg-gold px-4 py-2 text-sm font-semibold text-gold-foreground disabled:opacity-50">שמור</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>

  );
}
