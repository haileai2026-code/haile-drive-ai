import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AdminLoading } from "@/components/AdminShell";
import { adminApi, type ClassRow, type Candidate } from "@/lib/admin-api";
import { useAuth } from "@/lib/auth";
import { Plus, Pencil, Trash2, Users, UserPlus, X } from "lucide-react";
import { toast } from "sonner";

export function ClassesPanel() {
  const qc = useQueryClient();
  const { user, loading } = useAuth();
  const canQuery = !loading && !!user;
  const classesQ = useQuery({ queryKey: ["classes"], queryFn: adminApi.listClasses, enabled: canQuery });
  const citiesQ = useQuery({ queryKey: ["cities"], queryFn: adminApi.listCities, enabled: canQuery });
  const teachersQ = useQuery({ queryKey: ["teachers"], queryFn: adminApi.listTeachers, enabled: canQuery });
  const candidatesQ = useQuery({ queryKey: ["candidates"], queryFn: () => adminApi.listCandidates(), enabled: canQuery });
  const [editing, setEditing] = useState<Partial<ClassRow> | null>(null);
  const [assignFor, setAssignFor] = useState<ClassRow | null>(null);

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
  const assignMut = useMutation({
    mutationFn: ({ candidate, class_id }: { candidate: Candidate; class_id: string | null }) =>
      adminApi.upsertCandidate({ ...candidate, class_id } as any),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["candidates"] }); toast.success("עודכן"); },
    onError: (e: any) => toast.error(e.message),
  });

  const cityName = (id: string | null) => citiesQ.data?.find((c) => c.id === id)?.name_he ?? "—";
  const teacherName = (id: string | null) => teachersQ.data?.find((t) => t.id === id)?.full_name ?? "—";
  const studentsOf = (classId: string) => (candidatesQ.data ?? []).filter((s) => s.class_id === classId);
  const unassigned = (cityId: string | null) =>
    (candidatesQ.data ?? []).filter((s) => !s.class_id && (!cityId || !s.city_id || s.city_id === cityId));

  const isLoading = classesQ.isLoading || citiesQ.isLoading || teachersQ.isLoading || candidatesQ.isLoading;
  const loadError = classesQ.error || citiesQ.error || teachersQ.error || candidatesQ.error;

  return (
    <div>
      <div className="flex justify-end">
        <button onClick={() => setEditing({ name: "", capacity: 20 })} className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-gold px-4 text-sm font-semibold text-gold-foreground">
          <Plus className="h-4 w-4" /> כיתה חדשה
        </button>
      </div>

      {isLoading && <div className="mt-4"><AdminLoading label="טוען כיתות, ערים, מורים ותלמידים…" /></div>}
      {loadError && <div className="mt-4 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-300">טעינת הנתונים נכשלה: {(loadError as Error).message}</div>}

      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {classesQ.data?.map((c) => {
          const students = studentsOf(c.id);
          return (
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
                <div>קיבולת: {students.length}/{c.capacity}</div>
              </div>

              <div className="mt-3 border-t border-border/40 pt-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                    <Users className="h-3.5 w-3.5 text-gold" /> תלמידים משויכים ({students.length})
                  </span>
                  <button
                    onClick={() => setAssignFor(c)}
                    className="inline-flex items-center gap-1 rounded-lg border border-gold/40 bg-gold/10 px-2 py-1 text-[11px] font-semibold text-gold hover:bg-gold/20"
                  >
                    <UserPlus className="h-3 w-3" /> הוסף תלמיד
                  </button>
                </div>
                {students.length === 0 ? (
                  <div className="text-[11px] text-muted-foreground">אין תלמידים משויכים</div>
                ) : (
                  <ul className="space-y-1">
                    {students.map((s) => (
                      <li key={s.id} className="flex items-center justify-between rounded-md bg-background/40 px-2 py-1 text-xs">
                        <span className="truncate">{s.full_name}</span>
                        <button
                          onClick={() => { if (confirm(`להסיר את ${s.full_name} מהכיתה?`)) assignMut.mutate({ candidate: s, class_id: null }); }}
                          className="rounded p-0.5 text-rose-400 hover:bg-rose-500/10"
                          title="הסר מהכיתה"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </article>
          );
        })}
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

      {assignFor && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4" onClick={() => setAssignFor(null)}>
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md rounded-2xl border border-border bg-background p-5" dir="rtl">
            <h3 className="mb-1 text-lg font-bold">הוספת תלמיד לכיתה</h3>
            <p className="mb-4 text-xs text-muted-foreground">{assignFor.name} · {cityName(assignFor.city_id)}</p>
            {(() => {
              const list = unassigned(assignFor.city_id);
              if (list.length === 0) return <div className="rounded-lg border border-dashed border-border/60 p-4 text-center text-sm text-muted-foreground">כל התלמידים כבר משויכים לכיתה</div>;
              return (
                <ul className="max-h-80 space-y-1 overflow-y-auto">
                  {list.map((s) => (
                    <li key={s.id} className="flex items-center justify-between gap-2 rounded-lg border border-border/40 bg-background/40 p-2">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold">{s.full_name}</div>
                        <div className="text-[10px] text-muted-foreground">{cityName(s.city_id)} · {s.phone ?? "—"}</div>
                      </div>
                      <button
                        onClick={() => { assignMut.mutate({ candidate: s, class_id: assignFor.id }); setAssignFor(null); }}
                        className="rounded-lg bg-gold px-3 py-1.5 text-xs font-semibold text-gold-foreground"
                      >
                        שייך
                      </button>
                    </li>
                  ))}
                </ul>
              );
            })()}
            <div className="mt-4 flex justify-end">
              <button onClick={() => setAssignFor(null)} className="rounded-lg border border-border/60 px-4 py-2 text-sm">סגור</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
