import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { adminApi, type City } from "@/lib/admin-api";
import { Plus, Trash2, Pencil, ChevronDown, ChevronLeft, Users, BookOpen } from "lucide-react";
import { toast } from "sonner";

const STATUS_LABELS: Record<string, string> = {
  new_lead: "ליד חדש", contacted: "נוצר קשר", missing_docs: "חסרים מסמכים",
  waiting_opening: "ממתין", assigned: "שובץ", active: "פעיל",
  completed: "סיים", inactive: "לא פעיל", failed: "נכשל",
};

function CitiesPage() {
  return <AdminShell title="ערים, כיתות ותלמידים"><CitiesPanel /></AdminShell>;
}

export function CitiesPanel() {
  const qc = useQueryClient();
  const citiesQ = useQuery({ queryKey: ["cities"], queryFn: adminApi.listCities });
  const classesQ = useQuery({ queryKey: ["classes"], queryFn: adminApi.listClasses });
  const candidatesQ = useQuery({ queryKey: ["candidates"], queryFn: () => adminApi.listCandidates() });
  const teachersQ = useQuery({ queryKey: ["teachers"], queryFn: adminApi.listTeachers });

  const [editing, setEditing] = useState<Partial<City> | null>(null);
  const [openCities, setOpenCities] = useState<Record<string, boolean>>({});
  const [openClasses, setOpenClasses] = useState<Record<string, boolean>>({});

  const saveMut = useMutation({
    mutationFn: (c: Partial<City>) => adminApi.upsertCity(c as any),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["cities"] }); setEditing(null); toast.success("נשמר"); },
    onError: (e: any) => toast.error(e.message),
  });
  const delMut = useMutation({
    mutationFn: (id: string) => adminApi.deleteCity(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["cities"] }); toast.success("נמחק"); },
    onError: (e: any) => toast.error(e.message),
  });

  const teacherName = (id: string | null) =>
    teachersQ.data?.find((t) => t.id === id)?.full_name ?? "ללא מורה";

  return (
    <div>
      <div className="flex justify-end">
        <button onClick={() => setEditing({ name: "", name_he: "" })} className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-gold px-4 text-sm font-semibold text-gold-foreground">
          <Plus className="h-4 w-4" /> עיר חדשה
        </button>
      </div>

      <div className="mt-4 space-y-3">
        {citiesQ.data?.length === 0 && <div className="text-sm text-muted-foreground">אין ערים — הוסף עיר ראשונה</div>}
        {citiesQ.data?.map((c) => {
          const cityClasses = (classesQ.data ?? []).filter((cl) => cl.city_id === c.id);
          const isOpen = openCities[c.id] ?? true;
          return (
            <article key={c.id} className="rounded-2xl border border-border/60 bg-card/40">
              <header className="flex items-center justify-between p-4">
                <button
                  onClick={() => setOpenCities((s) => ({ ...s, [c.id]: !isOpen }))}
                  className="flex flex-1 items-center gap-2 text-right"
                >
                  {isOpen ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronLeft className="h-4 w-4 text-muted-foreground" />}
                  <div>
                    <div className="text-base font-bold">{c.name_he ?? c.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {cityClasses.length} כיתות · {(candidatesQ.data ?? []).filter((x) => x.city_id === c.id).length} תלמידים
                    </div>
                  </div>
                </button>
                <div className="flex gap-1">
                  <button onClick={() => setEditing(c)} className="rounded-md p-1.5 text-muted-foreground hover:bg-accent"><Pencil className="h-3.5 w-3.5" /></button>
                  <button onClick={() => { if (confirm("למחוק עיר?")) delMut.mutate(c.id); }} className="rounded-md p-1.5 text-rose-400 hover:bg-rose-500/10"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              </header>

              {isOpen && (
                <div className="border-t border-border/40 px-4 py-3">
                  {cityClasses.length === 0 && (
                    <div className="flex items-center justify-between rounded-xl border border-dashed border-border/60 p-3 text-sm text-muted-foreground">
                      <span>אין כיתות בעיר זו</span>
                      <Link to="/admin/classes" className="rounded-lg border border-border/60 bg-background/40 px-3 py-1.5 text-xs">פתח כיתה חדשה</Link>
                    </div>
                  )}
                  <div className="space-y-2">
                    {cityClasses.map((cl) => {
                      const students = (candidatesQ.data ?? []).filter((x) => x.class_id === cl.id);
                      const open = openClasses[cl.id] ?? false;
                      return (
                        <div key={cl.id} className="rounded-xl border border-border/50 bg-background/40">
                          <button
                            onClick={() => setOpenClasses((s) => ({ ...s, [cl.id]: !open }))}
                            className="flex w-full items-center justify-between gap-2 p-3 text-right"
                          >
                            <div className="flex items-center gap-2">
                              {open ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronLeft className="h-4 w-4 text-muted-foreground" />}
                              <BookOpen className="h-4 w-4 text-gold" />
                              <div>
                                <div className="text-sm font-semibold">{cl.name}</div>
                                <div className="text-[11px] text-muted-foreground">
                                  מורה: {teacherName(cl.teacher_id)} · {cl.schedule ?? "ללא מערכת"}
                                </div>
                              </div>
                            </div>
                            <span className="inline-flex items-center gap-1 rounded-full border border-gold/30 bg-gold/10 px-2 py-0.5 text-[11px] text-gold">
                              <Users className="h-3 w-3" /> {students.length}/{cl.capacity}
                            </span>
                          </button>
                          {open && (
                            <div className="border-t border-border/40 p-3">
                              {students.length === 0 ? (
                                <div className="text-xs text-muted-foreground">אין תלמידים בכיתה. שייך תלמידים מהמסך <Link to="/admin/candidates" className="underline">תלמידים</Link>.</div>
                              ) : (
                                <ul className="divide-y divide-border/30">
                                  {students.map((s) => (
                                    <li key={s.id} className="flex items-center justify-between py-2 text-sm">
                                      <div>
                                        <div className="font-semibold">{s.full_name}</div>
                                        <div className="text-[11px] text-muted-foreground">{s.phone ?? "—"}</div>
                                      </div>
                                      <span className="rounded-full border border-border/60 px-2 py-0.5 text-[10px] text-muted-foreground">
                                        {STATUS_LABELS[s.status] ?? s.status}
                                      </span>
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </article>
          );
        })}
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4" onClick={() => setEditing(null)}>
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md rounded-2xl border border-border bg-background p-5" dir="rtl">
            <h3 className="mb-4 text-lg font-bold">{editing.id ? "עריכת עיר" : "עיר חדשה"}</h3>
            <form onSubmit={(e) => { e.preventDefault(); if (!editing.name?.trim()) { toast.error("שם חובה"); return; } saveMut.mutate(editing); }} className="space-y-3">
              <label className="block">
                <span className="mb-1 block text-xs font-semibold">שם באנגלית *</span>
                <input required value={editing.name ?? ""} onChange={(e) => setEditing({ ...editing, name: e.target.value })} className="block w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-semibold">שם בעברית</span>
                <input value={editing.name_he ?? ""} onChange={(e) => setEditing({ ...editing, name_he: e.target.value })} className="block w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
              </label>
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
