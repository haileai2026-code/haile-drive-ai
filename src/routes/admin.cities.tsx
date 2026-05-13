import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AdminShell } from "@/components/AdminShell";
import { adminApi, type City } from "@/lib/admin-api";
import { Plus, Trash2, Pencil } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/cities")({
  head: () => ({ meta: [{ title: "ערים — Haile Drive AI" }] }),
  component: CitiesPage,
});

function CitiesPage() {
  const qc = useQueryClient();
  const citiesQ = useQuery({ queryKey: ["cities"], queryFn: adminApi.listCities });
  const [editing, setEditing] = useState<Partial<City> | null>(null);

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

  return (
    <AdminShell title="ערים ומסלולים">
      <div className="flex justify-end">
        <button onClick={() => setEditing({ name: "", name_he: "" })} className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-gold px-4 text-sm font-semibold text-gold-foreground">
          <Plus className="h-4 w-4" /> עיר חדשה
        </button>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {citiesQ.data?.map((c) => (
          <article key={c.id} className="flex items-center justify-between rounded-2xl border border-border/60 bg-card/40 p-4">
            <div>
              <div className="text-base font-bold">{c.name_he ?? c.name}</div>
              <div className="text-xs text-muted-foreground">{c.name}</div>
            </div>
            <div className="flex gap-1">
              <button onClick={() => setEditing(c)} className="rounded-md p-1.5 text-muted-foreground hover:bg-accent"><Pencil className="h-3.5 w-3.5" /></button>
              <button onClick={() => { if (confirm("למחוק עיר?")) delMut.mutate(c.id); }} className="rounded-md p-1.5 text-rose-400 hover:bg-rose-500/10"><Trash2 className="h-3.5 w-3.5" /></button>
            </div>
          </article>
        ))}
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
    </AdminShell>
  );
}
