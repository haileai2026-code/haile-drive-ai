import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AdminLoading, AdminShell } from "@/components/AdminShell";
import { adminApi, type ClassRow } from "@/lib/admin-api";
import { useAuth } from "@/lib/auth";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/classes")({
  head: () => ({ meta: [{ title: "כיתות — Haile Drive AI" }] }),
  component: ClassesPage,
});

function ClassesPage() {
  return <AdminShell title="ניהול כיתות"><ClassesPanel /></AdminShell>;
}

export function ClassesPanel() {
  const qc = useQueryClient();
  const { user, loading } = useAuth();
  const canQuery = !loading && !!user;
  const classesQ = useQuery({ queryKey: ["classes"], queryFn: adminApi.listClasses, enabled: canQuery });
  const citiesQ = useQuery({ queryKey: ["cities"], queryFn: adminApi.listCities, enabled: canQuery });
  const teachersQ = useQuery({ queryKey: ["teachers"], queryFn: adminApi.listTeachers, enabled: canQuery });
  const [editing, setEditing] = useState<Partial<ClassRow> | null>(null);

  const saveMut = useMutation({
    mutationFn: (c: Partial<ClassRow>) => adminApi.upsertClass(c as any),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["classes"] }); setEditing(null); toast.success("נשמר"); },
    onError: (e: any) => toast.error(e.message),
  });
  const delMut = useMutation({
    mutationFn: (id: string) => adminApi.deleteClass(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["classes"] }); toast.success("נמחק"); },
    onError: (e: any) => toast.error(e.message),
  });

  const cityName = (id: string | null) => citiesQ.data?.find((c) => c.id === id)?.name_he ?? "—";
  const teacherName = (id: string | null) => teachersQ.data?.find((t) => t.id === id)?.full_name ?? "—";
  const isLoading = classesQ.isLoading || citiesQ.isLoading || teachersQ.isLoading;
  const loadError = classesQ.error || citiesQ.error || teachersQ.error;

  return (
    <div>
      <div className="flex justify-end">
        <button onClick={() => setEditing({ name: "", capacity: 20 })} className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-gold px-4 text-sm font-semibold text-gold-foreground">
          <Plus className="h-4 w-4" /> כיתה חדשה
        </button>
      </div>

      {isLoading && <div className="mt-4"><AdminLoading label="טוען כיתות, ערים ומורים מהמסד…" /></div>}
      {loadError && <div className="mt-4 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-300">טעינת הנתונים נכשלה: {(loadError as Error).message}</div>}

      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {classesQ.data?.map((c) => (
          <article key={c.id} className="rounded-2xl border border-border/60 bg-card/40 p-4">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{cityName(c.city_id)}</div>
                <h3 className="mt-1 text-base font-bold">{c.name}</h3>
              </div>
              <div className="flex gap-1">
                <button onClick={() => setEditing(c)} className="rounded-md p-1.5 text-muted-foreground hover:bg-accent"><Pencil className="h-3.5 w-3.5" /></button>
                <button onClick={() => { if (confirm("למחוק כיתה?")) delMut.mutate(c.id); }} className="rounded-md p-1.5 text-rose-400 hover:bg-rose-500/10"><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
            </div>
            <div className="mt-3 space-y-1 text-sm text-muted-foreground">
              <div>מורה: {teacherName(c.teacher_id)}</div>
              <div>שעות: {c.schedule ?? "—"}</div>
              <div>קיבולת: {c.capacity}</div>
            </div>
          </article>
        ))}
        {!isLoading && classesQ.data?.length === 0 && <div className="text-sm text-muted-foreground">אין כיתות</div>}
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4" onClick={() => setEditing(null)}>
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md rounded-2xl border border-border bg-background p-5" dir="rtl">
            <h3 className="mb-4 text-lg font-bold">{editing.id ? "עריכת כיתה" : "כיתה חדשה"}</h3>
            <form onSubmit={(e) => { e.preventDefault(); if (!editing.name?.trim()) { toast.error("שם חובה"); return; } saveMut.mutate(editing); }} className="space-y-3">
              <label className="block">
                <span className="mb-1 block text-xs font-semibold">שם הכיתה *</span>
                <input required value={editing.name ?? ""} onChange={(e) => setEditing({ ...editing, name: e.target.value })} className="block w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-semibold">עיר</span>
                <select value={editing.city_id ?? ""} onChange={(e) => setEditing({ ...editing, city_id: e.target.value || null })} className="block w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                  <option value="">—</option>
                  {citiesQ.data?.map((c) => <option key={c.id} value={c.id}>{c.name_he ?? c.name}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-semibold">מורה משויך</span>
                <select value={editing.teacher_id ?? ""} onChange={(e) => setEditing({ ...editing, teacher_id: e.target.value || null })} className="block w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                  <option value="">—</option>
                  {teachersQ.data?.map((t) => <option key={t.id} value={t.id}>{t.full_name ?? t.email}</option>)}
                </select>
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="mb-1 block text-xs font-semibold">שעות / מערכת</span>
                  <input value={editing.schedule ?? ""} onChange={(e) => setEditing({ ...editing, schedule: e.target.value })} className="block w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-semibold">קיבולת</span>
                  <input type="number" value={editing.capacity ?? 20} onChange={(e) => setEditing({ ...editing, capacity: Number(e.target.value) })} className="block w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
                </label>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setEditing(null)} className="rounded-lg border border-border/60 px-4 py-2 text-sm">ביטול</button>
                <button type="submit" disabled={saveMut.isPending} className="rounded-lg bg-gold px-4 py-2 text-sm font-semibold text-gold-foreground disabled:opacity-50">שמור</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
