import { createFileRoute } from "@tanstack/react-router";
import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AdminLoading, AdminShell } from "@/components/AdminShell";
import { adminApi, docsApi, type Candidate, type CandidateDocument } from "@/lib/admin-api";
import { useAuth } from "@/lib/auth";
import { Plus, Pencil, Trash2, Search, FolderOpen, Upload, FileText, X, Download } from "lucide-react";
import { toast } from "sonner";

const DOC_PRESETS = [
  "טופס ירוק",
  "אישור לימודים ממשרד הרישוי",
  "ת.ז. — צד קדמי",
  "ת.ז. — צד אחורי",
  "רישיון נהיגה — קדמי",
  "רישיון נהיגה — אחורי",
  "תמונת פספורט",
  "אישור רפואי",
];

export const Route = createFileRoute("/admin/candidates")({
  head: () => ({ meta: [{ title: "תלמידים ולידים — Haile Drive AI" }] }),
  component: CandidatesPage,
});

const STATUS_LABELS: Record<string, string> = {
  new_lead: "ליד חדש",
  contacted: "נוצר קשר",
  missing_docs: "חסרים מסמכים",
  waiting_opening: "ממתין לפתיחה",
  assigned: "שובץ",
  active: "פעיל",
  completed: "סיים",
  inactive: "לא פעיל",
  failed: "נכשל",
};
const STATUSES = Object.keys(STATUS_LABELS);

type FormState = Partial<Candidate>;
const empty: FormState = { full_name: "", phone: "", email: "", status: "new_lead", language: "he", notes: "" };

function CandidatesPage() {
  const qc = useQueryClient();
  const { user, loading } = useAuth();
  const canQuery = !loading && !!user;
  const [q, setQ] = useState("");
  const [statusF, setStatusF] = useState<string>("all");
  const [cityF, setCityF] = useState<string>("all");
  const [editing, setEditing] = useState<FormState | null>(null);
  const [folderFor, setFolderFor] = useState<Candidate | null>(null);

  const candidatesQ = useQuery({ queryKey: ["candidates"], queryFn: () => adminApi.listCandidates(), enabled: canQuery });
  const citiesQ = useQuery({ queryKey: ["cities"], queryFn: adminApi.listCities, enabled: canQuery });
  const classesQ = useQuery({ queryKey: ["classes"], queryFn: adminApi.listClasses, enabled: canQuery });

  const saveMut = useMutation({
    mutationFn: (c: FormState) => adminApi.upsertCandidate(c as any),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["candidates"] }); setEditing(null); toast.success("נשמר"); },
    onError: (e: any) => toast.error(e.message ?? "שמירה נכשלה"),
  });
  const delMut = useMutation({
    mutationFn: (id: string) => adminApi.deleteCandidate(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["candidates"] }); toast.success("נמחק"); },
    onError: (e: any) => toast.error(e.message ?? "מחיקה נכשלה"),
  });

  const cityName = (id: string | null) => citiesQ.data?.find((c) => c.id === id)?.name_he ?? "—";
  const className = (id: string | null) => classesQ.data?.find((c) => c.id === id)?.name ?? "—";

  const filtered = (candidatesQ.data ?? []).filter((c) => {
    if (statusF !== "all" && c.status !== statusF) return false;
    if (cityF !== "all" && c.city_id !== cityF) return false;
    if (q && !`${c.full_name} ${c.phone ?? ""} ${c.email ?? ""}`.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  });
  const isLoading = candidatesQ.isLoading || citiesQ.isLoading || classesQ.isLoading;

  return (
    <AdminShell title="ניהול לידים ותלמידים">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="חיפוש שם / טלפון / אימייל…"
            className="h-10 w-full rounded-xl border border-input bg-background ps-9 pe-3 text-sm outline-none focus:ring-1 focus:ring-gold" />
        </div>
        <select value={cityF} onChange={(e) => setCityF(e.target.value)} className="h-10 rounded-xl border border-input bg-background px-3 text-sm">
          <option value="all">כל הערים</option>
          {citiesQ.data?.map((c) => <option key={c.id} value={c.id}>{c.name_he ?? c.name}</option>)}
        </select>
        <select value={statusF} onChange={(e) => setStatusF(e.target.value)} className="h-10 rounded-xl border border-input bg-background px-3 text-sm">
          <option value="all">כל הסטטוסים</option>
          {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
        </select>
        <button onClick={() => setEditing({ ...empty })} className="ms-auto inline-flex h-10 items-center gap-1.5 rounded-xl bg-gold px-4 text-sm font-semibold text-gold-foreground hover:opacity-90">
          <Plus className="h-4 w-4" /> תלמיד חדש
        </button>
      </div>

      {isLoading && <div className="mt-4"><AdminLoading label="טוען תלמידים, ערים וכיתות מהמסד…" /></div>}
      {(candidatesQ.error || citiesQ.error || classesQ.error) && (
        <div className="mt-4 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-300">
          טעינת הנתונים נכשלה: {((candidatesQ.error || citiesQ.error || classesQ.error) as Error).message}
        </div>
      )}

      <div className="mt-4 overflow-hidden rounded-2xl border border-border/60 bg-card/40">
        <table className="w-full text-sm">
          <thead className="bg-background/40 text-right text-[11px] uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-3 py-2">שם</th>
              <th className="px-3 py-2">טלפון</th>
              <th className="px-3 py-2">עיר</th>
              <th className="px-3 py-2">כיתה</th>
              <th className="px-3 py-2">שפה</th>
              <th className="px-3 py-2">סטטוס</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {isLoading && <tr><td colSpan={7} className="px-3 py-10 text-center text-muted-foreground">טוען נתונים חיים…</td></tr>}
            {!isLoading && filtered.length === 0 && <tr><td colSpan={7} className="px-3 py-10 text-center text-muted-foreground">אין רשומות</td></tr>}
            {filtered.map((c) => (
              <tr key={c.id} className="hover:bg-accent/30">
                <td className="px-3 py-3 font-semibold">{c.full_name}</td>
                <td className="px-3 py-3 text-muted-foreground">{c.phone}</td>
                <td className="px-3 py-3 text-muted-foreground">{cityName(c.city_id)}</td>
                <td className="px-3 py-3 text-muted-foreground">{className(c.class_id)}</td>
                <td className="px-3 py-3 text-muted-foreground">{c.language}</td>
                <td className="px-3 py-3"><span className="rounded-full border border-gold/30 bg-gold/10 px-2 py-0.5 text-[10px] text-gold">{STATUS_LABELS[c.status] ?? c.status}</span></td>
                <td className="px-3 py-3">
                  <div className="flex justify-end gap-1">
                    <button onClick={() => setFolderFor(c)} title="תיק נהג" className="rounded-md p-1.5 text-gold hover:bg-gold/10"><FolderOpen className="h-3.5 w-3.5" /></button>
                    <button onClick={() => setEditing(c)} className="rounded-md p-1.5 text-muted-foreground hover:bg-accent"><Pencil className="h-3.5 w-3.5" /></button>
                    <button onClick={() => { if (confirm(`למחוק את ${c.full_name}?`)) delMut.mutate(c.id); }} className="rounded-md p-1.5 text-rose-400 hover:bg-rose-500/10"><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4" onClick={() => setEditing(null)}>
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-lg rounded-2xl border border-border bg-background p-5" dir="rtl">
            <h3 className="mb-4 text-lg font-bold">{editing.id ? "עריכת תלמיד" : "תלמיד חדש"}</h3>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!editing.full_name?.trim()) { toast.error("שם חובה"); return; }
                saveMut.mutate(editing);
              }}
              className="space-y-3"
            >
              <Field label="שם מלא *"><input required value={editing.full_name ?? ""} onChange={(e) => setEditing({ ...editing, full_name: e.target.value })} className="inp" /></Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="טלפון"><input value={editing.phone ?? ""} onChange={(e) => setEditing({ ...editing, phone: e.target.value })} className="inp" /></Field>
                <Field label="אימייל"><input type="email" value={editing.email ?? ""} onChange={(e) => setEditing({ ...editing, email: e.target.value })} className="inp" /></Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="עיר">
                  <select value={editing.city_id ?? ""} onChange={(e) => setEditing({ ...editing, city_id: e.target.value || null })} className="inp">
                    <option value="">—</option>
                    {citiesQ.data?.map((c) => <option key={c.id} value={c.id}>{c.name_he ?? c.name}</option>)}
                  </select>
                </Field>
                <Field label="כיתה">
                  <select value={editing.class_id ?? ""} onChange={(e) => setEditing({ ...editing, class_id: e.target.value || null })} className="inp">
                    <option value="">—</option>
                    {classesQ.data?.filter((cl) => !editing.city_id || cl.city_id === editing.city_id).map((cl) => <option key={cl.id} value={cl.id}>{cl.name}</option>)}
                  </select>
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="שפה">
                  <select value={editing.language ?? "he"} onChange={(e) => setEditing({ ...editing, language: e.target.value })} className="inp">
                    {["he","am","ru","en","fr","kuki"].map((l) => <option key={l}>{l}</option>)}
                  </select>
                </Field>
                <Field label="סטטוס">
                  <select value={editing.status ?? "new_lead"} onChange={(e) => setEditing({ ...editing, status: e.target.value as any })} className="inp">
                    {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
                  </select>
                </Field>
              </div>
              <Field label="הערות"><textarea value={editing.notes ?? ""} onChange={(e) => setEditing({ ...editing, notes: e.target.value })} className="inp min-h-[80px]" /></Field>

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setEditing(null)} className="rounded-lg border border-border/60 px-4 py-2 text-sm">ביטול</button>
                <button type="submit" disabled={saveMut.isPending} className="rounded-lg bg-gold px-4 py-2 text-sm font-semibold text-gold-foreground disabled:opacity-50">{saveMut.isPending ? "שומר…" : "שמור"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
      <style>{`.inp{display:block;width:100%;border-radius:.5rem;border:1px solid hsl(var(--input));background:hsl(var(--background));padding:.5rem .75rem;font-size:.875rem;outline:none}.inp:focus{box-shadow:0 0 0 1px hsl(var(--ring))}`}</style>
    </AdminShell>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
