import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AdminShell, AdminLoading } from "@/components/AdminShell";
import { supabase } from "@/integrations/supabase/client";
import { adminApi } from "@/lib/admin-api";
import {
  coursesApi, STATUS_LABEL, LANG_LABEL, CONTENT_TYPE_LABEL,
  type OnlineCourse, type CourseStatus, type CourseContentType,
} from "@/lib/courses-api";
import { Plus, Trash2, ChevronUp, ChevronDown, Users, Pencil } from "lucide-react";

export const Route = createFileRoute("/admin/courses")({
  head: () => ({
    meta: [
      { title: "ניהול קורסים מקוונים — Haile Drive AI" },
      { name: "description", content: "יצירה ועריכה של קורסים מקוונים, מודולים, שיעורים ומעקב הרשמות ב-Haile Drive AI." },
      { property: "og:title", content: "ניהול קורסים מקוונים — Haile Drive AI" },
      { property: "og:description", content: "ניהול קורסים, מודולים, שיעורים והרשמות." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AdminCoursesPage,
});

const input = "min-h-11 w-full rounded-xl border border-border/60 bg-background px-3 text-sm";
const btnGold = "min-h-11 rounded-xl bg-gold px-4 text-sm font-bold text-gold-foreground disabled:opacity-60";
const btnGhost = "min-h-11 rounded-xl border border-border/60 px-3 text-sm text-muted-foreground hover:bg-accent";

function AdminCoursesPage() {
  const qc = useQueryClient();
  const [selected, setSelected] = useState<string | null>(null);
  const [editing, setEditing] = useState<Partial<OnlineCourse> | null>(null);

  const coursesQ = useQuery({
    queryKey: ["admin-online-courses"],
    queryFn: () => coursesApi.list({ includeUnpublished: true }),
  });

  const saveM = useMutation({
    mutationFn: (c: Partial<OnlineCourse> & { title_he: string }) => coursesApi.upsertCourse(c),
    onSuccess: () => {
      toast.success("הקורס נשמר");
      setEditing(null);
      qc.invalidateQueries({ queryKey: ["admin-online-courses"] });
    },
    onError: () => toast.error("שמירת הקורס נכשלה"),
  });

  const delM = useMutation({
    mutationFn: (id: string) => coursesApi.deleteCourse(id),
    onSuccess: () => {
      toast.success("הקורס נמחק");
      setSelected(null);
      qc.invalidateQueries({ queryKey: ["admin-online-courses"] });
    },
    onError: () => toast.error("מחיקת הקורס נכשלה"),
  });

  const courses = coursesQ.data ?? [];

  return (
    <AdminShell title="🎓 קורסים מקוונים" roles={["owner", "staff"]}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">ניהול קטלוג הקורסים המקוונים, המודולים והשיעורים</p>
        <button className={btnGold} onClick={() => setEditing({ title_he: "", status: "draft", language: "he", price_ils: 0, sort_order: courses.length })}>
          <span className="inline-flex items-center gap-1"><Plus className="h-4 w-4" /> קורס חדש</span>
        </button>
      </div>

      {editing && (
        <CourseForm
          value={editing}
          onChange={setEditing}
          onCancel={() => setEditing(null)}
          onSave={() => {
            if (!editing.title_he?.trim()) return toast.error("נא להזין כותרת בעברית");
            saveM.mutate(editing as Partial<OnlineCourse> & { title_he: string });
          }}
          saving={saveM.isPending}
        />
      )}

      {coursesQ.isLoading && <div className="mt-6"><AdminLoading label="טוען קורסים…" /></div>}

      {!coursesQ.isLoading && courses.length === 0 && !editing && (
        <div className="mt-6 rounded-2xl border border-dashed border-border/60 bg-card/40 p-8 text-center text-sm text-muted-foreground">
          אין עדיין קורסים מקוונים. לחצו «קורס חדש» כדי להתחיל.
        </div>
      )}

      <div className="mt-4 space-y-3">
        {courses.map((c) => (
          <div key={c.id} className="rounded-2xl border border-border/60 bg-card/40 p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="text-sm font-bold">{c.title_he}</div>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                  <span className="rounded-full border border-border/60 px-2 py-0.5">{STATUS_LABEL[c.status]}</span>
                  <span className="rounded-full border border-border/60 px-2 py-0.5">{LANG_LABEL[c.language] ?? c.language}</span>
                  <span>{Number(c.price_ils) > 0 ? `${Number(c.price_ils).toLocaleString("he-IL")} ₪` : "ללא עלות"}</span>
                  {c.estimated_hours != null && <span>{c.estimated_hours} שעות</span>}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <button className={btnGhost} onClick={() => setEditing(c)}>
                  <span className="inline-flex items-center gap-1"><Pencil className="h-3.5 w-3.5" /> עריכה</span>
                </button>
                {(["draft", "published", "archived"] as CourseStatus[])
                  .filter((s) => s !== c.status)
                  .map((s) => (
                    <button key={s} className={btnGhost} onClick={() => saveM.mutate({ ...c, status: s })}>
                      {s === "published" ? "פרסם" : s === "draft" ? "החזר לטיוטה" : "ארכב"}
                    </button>
                  ))}
                <button className={btnGhost} onClick={() => setSelected(selected === c.id ? null : c.id)}>
                  {selected === c.id ? "סגור תוכן" : "נהל תוכן"}
                </button>
                <button
                  className="min-h-11 rounded-xl border border-rose-500/40 px-3 text-sm text-rose-300"
                  onClick={() => { if (confirm(`למחוק את «${c.title_he}»? כל המודולים והשיעורים יימחקו.`)) delM.mutate(c.id); }}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>

            {selected === c.id && (
              <div className="mt-4 space-y-4 border-t border-border/60 pt-4">
                <CourseContent courseId={c.id} />
                <Enrollments courseId={c.id} />
              </div>
            )}
          </div>
        ))}
      </div>
    </AdminShell>
  );
}

function CourseForm({
  value, onChange, onSave, onCancel, saving,
}: {
  value: Partial<OnlineCourse>;
  onChange: (v: Partial<OnlineCourse>) => void;
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const set = (patch: Partial<OnlineCourse>) => onChange({ ...value, ...patch });
  return (
    <div className="mt-4 rounded-2xl border border-gold/30 bg-card/60 p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-xs text-muted-foreground">כותרת (עברית)
          <input className={input} value={value.title_he ?? ""} onChange={(e) => set({ title_he: e.target.value })} />
        </label>
        <label className="text-xs text-muted-foreground">כותרת (אמהרית)
          <input className={input} lang="am" value={value.title_am ?? ""} onChange={(e) => set({ title_am: e.target.value })} />
        </label>
        <label className="text-xs text-muted-foreground sm:col-span-2">תיאור (עברית)
          <textarea className="min-h-24 w-full rounded-xl border border-border/60 bg-background p-3 text-sm"
            value={value.description_he ?? ""} onChange={(e) => set({ description_he: e.target.value })} />
        </label>
        <label className="text-xs text-muted-foreground sm:col-span-2">תיאור (אמהרית)
          <textarea className="min-h-20 w-full rounded-xl border border-border/60 bg-background p-3 text-sm" lang="am"
            value={value.description_am ?? ""} onChange={(e) => set({ description_am: e.target.value })} />
        </label>
        <label className="text-xs text-muted-foreground">מחיר (₪)
          <input type="number" min={0} className={input} value={value.price_ils ?? 0}
            onChange={(e) => set({ price_ils: Number(e.target.value) })} />
        </label>
        <label className="text-xs text-muted-foreground">שעות לימוד משוערות
          <input type="number" min={0} className={input} value={value.estimated_hours ?? ""}
            onChange={(e) => set({ estimated_hours: e.target.value === "" ? null : Number(e.target.value) })} />
        </label>
        <label className="text-xs text-muted-foreground">שפה
          <select className={input} value={value.language ?? "he"} onChange={(e) => set({ language: e.target.value })}>
            {Object.entries(LANG_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </label>
        <label className="text-xs text-muted-foreground">סטטוס
          <select className={input} value={value.status ?? "draft"} onChange={(e) => set({ status: e.target.value as CourseStatus })}>
            {Object.entries(STATUS_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </label>
        <label className="text-xs text-muted-foreground sm:col-span-2">תמונת נושא (HTTPS)
          <input className={input} value={value.cover_image_url ?? ""} placeholder="https://…"
            onChange={(e) => set({ cover_image_url: e.target.value || null })} />
        </label>
      </div>
      <div className="mt-4 flex gap-2">
        <button className={btnGold} disabled={saving} onClick={onSave}>שמירה</button>
        <button className={btnGhost} onClick={onCancel}>ביטול</button>
      </div>
    </div>
  );
}

function CourseContent({ courseId }: { courseId: string }) {
  const qc = useQueryClient();
  const outlineQ = useQuery({ queryKey: ["admin-course-outline", courseId], queryFn: () => coursesApi.outline(courseId) });
  const materialsQ = useQuery({ queryKey: ["admin-materials"], queryFn: () => adminApi.listMaterials() });
  const refresh = () => qc.invalidateQueries({ queryKey: ["admin-course-outline", courseId] });
  const [newModule, setNewModule] = useState("");

  const run = async (fn: () => Promise<unknown>, okMsg: string) => {
    try { await fn(); refresh(); toast.success(okMsg); }
    catch { toast.error("הפעולה נכשלה"); }
  };

  const modules = outlineQ.data?.modules ?? [];

  return (
    <div>
      <h3 className="text-sm font-bold text-gold">מודולים ושיעורים</h3>

      <div className="mt-2 flex flex-wrap gap-2">
        <input className={`${input} max-w-xs`} placeholder="שם מודול חדש" value={newModule} onChange={(e) => setNewModule(e.target.value)} />
        <button
          className={btnGold}
          onClick={() => {
            if (!newModule.trim()) return;
            run(() => coursesApi.upsertModule({ course_id: courseId, title_he: newModule.trim(), sort_order: modules.length }), "המודול נוסף")
              .then(() => setNewModule(""));
          }}
        >הוסף מודול</button>
      </div>

      {outlineQ.isLoading && <div className="mt-3 text-sm text-muted-foreground">טוען תוכן…</div>}
      {!outlineQ.isLoading && modules.length === 0 && (
        <div className="mt-3 rounded-xl border border-dashed border-border/60 p-6 text-center text-sm text-muted-foreground">
          אין עדיין מודולים בקורס.
        </div>
      )}

      <div className="mt-3 space-y-3">
        {modules.map((m, mi) => (
          <div key={m.id} className="rounded-xl border border-border/60 bg-background/40 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-sm font-bold">{mi + 1}. {m.title_he}</div>
              <div className="flex gap-1">
                <button className={btnGhost} disabled={mi === 0}
                  onClick={() => run(() => coursesApi.moveModule(m.id, mi - 1), "סודר מחדש")}><ChevronUp className="h-4 w-4" /></button>
                <button className={btnGhost} disabled={mi === modules.length - 1}
                  onClick={() => run(() => coursesApi.moveModule(m.id, mi + 1), "סודר מחדש")}><ChevronDown className="h-4 w-4" /></button>
                <button className="min-h-11 rounded-xl border border-rose-500/40 px-3 text-rose-300"
                  onClick={() => { if (confirm(`למחוק את המודול «${m.title_he}»?`)) run(() => coursesApi.deleteModule(m.id), "המודול נמחק"); }}>
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>

            <ul className="mt-2 space-y-1">
              {m.lessons.map((l, li) => (
                <li key={l.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-accent/40">
                  <span className="min-w-0 flex-1 truncate">
                    {li + 1}. {l.title_he}
                    <span className="mr-2 text-[11px] text-muted-foreground">({CONTENT_TYPE_LABEL[l.content_type]})</span>
                    {l.is_free_preview && <span className="mr-1 rounded-full border border-gold/40 px-2 py-0.5 text-[10px] text-gold">הדגמה חופשית</span>}
                  </span>
                  <span className="flex gap-1">
                    <button className={btnGhost} disabled={li === 0}
                      onClick={() => run(() => coursesApi.moveLesson(l.id, li - 1), "סודר מחדש")}><ChevronUp className="h-4 w-4" /></button>
                    <button className={btnGhost} disabled={li === m.lessons.length - 1}
                      onClick={() => run(() => coursesApi.moveLesson(l.id, li + 1), "סודר מחדש")}><ChevronDown className="h-4 w-4" /></button>
                    <button className="min-h-11 rounded-xl border border-rose-500/40 px-3 text-rose-300"
                      onClick={() => { if (confirm(`למחוק את השיעור «${l.title_he}»?`)) run(() => coursesApi.deleteLesson(l.id), "השיעור נמחק"); }}>
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </span>
                </li>
              ))}
              {m.lessons.length === 0 && <li className="px-2 py-1 text-xs text-muted-foreground">אין שיעורים במודול הזה.</li>}
            </ul>

            <NewLessonForm
              moduleId={m.id}
              nextOrder={m.lessons.length}
              materials={(materialsQ.data ?? []).map((x) => ({ id: x.id, title: x.title }))}
              onCreated={refresh}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function NewLessonForm({
  moduleId, nextOrder, materials, onCreated,
}: {
  moduleId: string; nextOrder: number;
  materials: { id: string; title: string }[];
  onCreated: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [type, setType] = useState<CourseContentType>("text");
  const [body, setBody] = useState("");
  const [url, setUrl] = useState("");
  const [materialId, setMaterialId] = useState("");
  const [minutes, setMinutes] = useState("");
  const [preview, setPreview] = useState(false);
  const [saving, setSaving] = useState(false);

  if (!open) {
    return (
      <button className={`${btnGhost} mt-2`} onClick={() => setOpen(true)}>
        <span className="inline-flex items-center gap-1"><Plus className="h-3.5 w-3.5" /> הוסף שיעור</span>
      </button>
    );
  }

  const save = async () => {
    if (!title.trim()) return toast.error("נא להזין כותרת לשיעור");
    setSaving(true);
    try {
      await coursesApi.upsertLesson({
        module_id: moduleId,
        title_he: title.trim(),
        sort_order: nextOrder,
        content_type: type,
        content_body: type === "text" ? body || null : null,
        video_url: type === "video" || type === "live_link" ? (url || null) : null,
        material_id: type === "material" ? (materialId || null) : null,
        duration_minutes: minutes ? Number(minutes) : null,
        is_free_preview: preview,
      });
      toast.success("השיעור נוסף");
      setOpen(false); setTitle(""); setBody(""); setUrl(""); setMaterialId(""); setMinutes(""); setPreview(false);
      onCreated();
    } catch {
      toast.error("הוספת השיעור נכשלה");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-3 rounded-xl border border-gold/30 p-3">
      <div className="grid gap-2 sm:grid-cols-2">
        <input className={input} placeholder="כותרת השיעור" value={title} onChange={(e) => setTitle(e.target.value)} />
        <select className={input} value={type} onChange={(e) => setType(e.target.value as CourseContentType)}>
          {Object.entries(CONTENT_TYPE_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
        {type === "text" && (
          <textarea className="min-h-24 w-full rounded-xl border border-border/60 bg-background p-3 text-sm sm:col-span-2"
            placeholder="תוכן השיעור" value={body} onChange={(e) => setBody(e.target.value)} />
        )}
        {(type === "video" || type === "live_link") && (
          <input className={`${input} sm:col-span-2`} placeholder="https://… קישור" value={url} onChange={(e) => setUrl(e.target.value)} />
        )}
        {type === "material" && (
          <select className={`${input} sm:col-span-2`} value={materialId} onChange={(e) => setMaterialId(e.target.value)}>
            <option value="">בחרו חומר לימוד…</option>
            {materials.map((m) => <option key={m.id} value={m.id}>{m.title}</option>)}
          </select>
        )}
        <input className={input} type="number" min={0} placeholder="משך בדקות" value={minutes} onChange={(e) => setMinutes(e.target.value)} />
        <label className="flex min-h-11 items-center gap-2 text-sm text-muted-foreground">
          <input type="checkbox" checked={preview} onChange={(e) => setPreview(e.target.checked)} />
          שיעור הדגמה חופשי (גם ללידים)
        </label>
      </div>
      <div className="mt-3 flex gap-2">
        <button className={btnGold} disabled={saving} onClick={save}>שמירה</button>
        <button className={btnGhost} onClick={() => setOpen(false)}>ביטול</button>
      </div>
    </div>
  );
}

function Enrollments({ courseId }: { courseId: string }) {
  const q = useQuery({
    queryKey: ["admin-course-enrollments", courseId],
    queryFn: async () => {
      const rows = await coursesApi.listEnrollments(courseId);
      if (!rows.length) return [];
      const { data } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", rows.map((r) => r.student_id));
      const map = new Map((data ?? []).map((p) => [p.id, p]));
      return rows.map((r) => ({ ...r, profile: map.get(r.student_id) ?? null }));
    },
  });

  return (
    <div>
      <h3 className="flex items-center gap-1 text-sm font-bold text-gold"><Users className="h-4 w-4" /> נרשמים</h3>
      {q.isLoading && <div className="mt-2 text-sm text-muted-foreground">טוען הרשמות…</div>}
      {!q.isLoading && (q.data?.length ?? 0) === 0 && (
        <div className="mt-2 rounded-xl border border-dashed border-border/60 p-4 text-center text-sm text-muted-foreground">
          אין עדיין נרשמים לקורס.
        </div>
      )}
      <ul className="mt-2 space-y-1">
        {(q.data ?? []).map((e) => (
          <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/60 px-3 py-2 text-sm">
            <span className="min-w-0 truncate">{e.profile?.full_name || e.profile?.email || "—"}</span>
            <span className="flex items-center gap-3 text-xs text-muted-foreground">
              <span>{new Date(e.enrolled_at).toLocaleDateString("he-IL")}</span>
              <span className="text-gold">{Math.round(Number(e.progress_pct))}%</span>
              <span>{e.status === "completed" ? "הושלם" : e.status === "cancelled" ? "בוטל" : "פעיל"}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
