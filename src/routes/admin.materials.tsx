import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AdminLoading, AdminShell } from "@/components/AdminShell";
import { adminApi, type Material } from "@/lib/admin-api";
import { useAuth } from "@/lib/auth";
import { Plus, Trash2, FileText, Image as ImageIcon, Link as LinkIcon, Pencil } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/materials")({
  head: () => ({ meta: [{ title: "חומרי לימוד — Haile Drive AI" }] }),
  component: MaterialsPage,
});

function MaterialsPage() {
  return (
    <AdminShell title="חומרי לימוד והעשרה">
      <MaterialsPanel />
    </AdminShell>
  );
}

export function MaterialsPanel() {
  const qc = useQueryClient();
  const { user, loading } = useAuth();
  const canQuery = !loading && !!user;
  const [tab, setTab] = useState<"study" | "enrichment">("study");
  const [editing, setEditing] = useState<Partial<Material> | null>(null);
  const [uploading, setUploading] = useState(false);

  const matsQ = useQuery({ queryKey: ["materials"], queryFn: () => adminApi.listMaterials(), enabled: canQuery });
  const classesQ = useQuery({ queryKey: ["classes"], queryFn: adminApi.listClasses, enabled: canQuery });

  const saveMut = useMutation({
    mutationFn: (m: Partial<Material>) => adminApi.upsertMaterial(m as any),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["materials"] }); setEditing(null); toast.success("נשמר"); },
    onError: (e: any) => toast.error(e.message),
  });
  const delMut = useMutation({
    mutationFn: (id: string) => adminApi.deleteMaterial(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["materials"] }); toast.success("נמחק"); },
    onError: (e: any) => toast.error(e.message),
  });

  const handleUpload = async (file: File) => {
    try {
      setUploading(true);
      const url = await adminApi.uploadMaterialFile(file);
      setEditing((p) => ({ ...(p ?? {}), file_url: url }));
      toast.success("קובץ הועלה");
    } catch (e: any) { toast.error(e.message ?? "העלאה נכשלה"); }
    finally { setUploading(false); }
  };

  const list = (matsQ.data ?? []).filter((m) => m.category === tab);

  const TYPE_ICON = { pdf: FileText, image: ImageIcon, link: LinkIcon, video: LinkIcon } as const;
  const isLoading = matsQ.isLoading || classesQ.isLoading;
  const loadError = matsQ.error || classesQ.error;

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-2">
          <button onClick={() => setTab("study")} className={`rounded-xl px-4 py-2 text-sm ${tab === "study" ? "bg-gold text-gold-foreground" : "border border-border/60"}`}>חומרי לימוד</button>
          <button onClick={() => setTab("enrichment")} className={`rounded-xl px-4 py-2 text-sm ${tab === "enrichment" ? "bg-gold text-gold-foreground" : "border border-border/60"}`}>חומרי העשרה</button>
        </div>
        <button onClick={() => setEditing({ category: tab, type: "pdf", title: "" })} className="ms-auto inline-flex h-10 items-center gap-1.5 rounded-xl bg-gold px-4 text-sm font-semibold text-gold-foreground">
          <Plus className="h-4 w-4" /> חומר חדש
        </button>
      </div>

      {isLoading && <div className="mt-4"><AdminLoading label="טוען חומרי לימוד וכיתות מהמסד…" /></div>}
      {loadError && <div className="mt-4 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-300">טעינת הנתונים נכשלה: {(loadError as Error).message}</div>}

      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {!isLoading && list.length === 0 && <div className="text-sm text-muted-foreground">אין חומרים. הוסף חומר ראשון.</div>}
        {list.map((m) => {
          const Icon = TYPE_ICON[m.type];
          const url = m.file_url ?? m.external_link ?? "#";
          return (
            <article key={m.id} className="rounded-2xl border border-border/60 bg-card/40 p-4">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-xl bg-gold/15 text-gold"><Icon className="h-5 w-5" /></div>
                  <div>
                    <h3 className="text-base font-bold">{m.title}</h3>
                    {m.description && <p className="mt-1 text-xs text-muted-foreground">{m.description}</p>}
                  </div>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => setEditing(m)} className="rounded-md p-1.5 text-muted-foreground hover:bg-accent"><Pencil className="h-3.5 w-3.5" /></button>
                  <button onClick={() => { if (confirm("למחוק?")) delMut.mutate(m.id); }} className="rounded-md p-1.5 text-rose-400 hover:bg-rose-500/10"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              </div>
              <a href={url} target="_blank" rel="noreferrer" className="mt-3 inline-block text-xs text-gold hover:underline">פתח →</a>
            </article>
          );
        })}
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4" onClick={() => setEditing(null)}>
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-lg rounded-2xl border border-border bg-background p-5" dir="rtl">
            <h3 className="mb-4 text-lg font-bold">{editing.id ? "עריכת חומר" : "חומר חדש"}</h3>
            <form onSubmit={(e) => { e.preventDefault(); if (!editing.title?.trim()) { toast.error("כותרת חובה"); return; } saveMut.mutate(editing); }} className="space-y-3">
              <label className="block">
                <span className="mb-1 block text-xs font-semibold">כותרת *</span>
                <input required value={editing.title ?? ""} onChange={(e) => setEditing({ ...editing, title: e.target.value })} className="block w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-semibold">תיאור</span>
                <textarea value={editing.description ?? ""} onChange={(e) => setEditing({ ...editing, description: e.target.value })} className="block w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="mb-1 block text-xs font-semibold">קטגוריה</span>
                  <select value={editing.category ?? "study"} onChange={(e) => setEditing({ ...editing, category: e.target.value as any })} className="block w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                    <option value="study">חומרי לימוד</option>
                    <option value="enrichment">חומרי העשרה</option>
                  </select>
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-semibold">סוג</span>
                  <select value={editing.type ?? "pdf"} onChange={(e) => setEditing({ ...editing, type: e.target.value as any })} className="block w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                    <option value="pdf">PDF</option>
                    <option value="image">תמונה</option>
                    <option value="link">קישור</option>
                    <option value="video">וידאו</option>
                  </select>
                </label>
              </div>
              {(editing.type === "pdf" || editing.type === "image") && (
                <label className="block">
                  <span className="mb-1 block text-xs font-semibold">קובץ {editing.file_url && "(קיים)"}</span>
                  <input type="file" accept={editing.type === "pdf" ? "application/pdf" : "image/*"} onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])} className="block w-full text-sm" />
                  {uploading && <div className="mt-1 text-xs text-muted-foreground">מעלה…</div>}
                  {editing.file_url && <div className="mt-1 truncate text-[10px] text-muted-foreground">{editing.file_url}</div>}
                </label>
              )}
              {(editing.type === "link" || editing.type === "video") && (
                <label className="block">
                  <span className="mb-1 block text-xs font-semibold">קישור חיצוני</span>
                  <input type="url" value={editing.external_link ?? ""} onChange={(e) => setEditing({ ...editing, external_link: e.target.value })} className="block w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
                </label>
              )}
              <label className="block">
                <span className="mb-1 block text-xs font-semibold">משויך לכיתה (אופציונלי)</span>
                <select value={editing.class_id ?? ""} onChange={(e) => setEditing({ ...editing, class_id: e.target.value || null })} className="block w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                  <option value="">— לכל הכיתות —</option>
                  {classesQ.data?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </label>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setEditing(null)} className="rounded-lg border border-border/60 px-4 py-2 text-sm">ביטול</button>
                <button type="submit" disabled={saveMut.isPending || uploading} className="rounded-lg bg-gold px-4 py-2 text-sm font-semibold text-gold-foreground disabled:opacity-50">שמור</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>

  );
}
