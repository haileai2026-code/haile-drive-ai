import { useState, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { X, Upload, Download, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { adminApi } from "@/lib/admin-api";
import { importStudents } from "@/lib/admin-users.functions";

type Row = { full_name: string; email: string; error?: string };

function parseCsv(text: string): Row[] {
  const lines = text.replace(/\r/g, "").split("\n").map((l) => l.trim()).filter(Boolean);
  if (!lines.length) return [];
  // skip header if present
  const first = lines[0].toLowerCase();
  const start = first.includes("full_name") || first.includes("email") || first.includes("שם") ? 1 : 0;
  const rows: Row[] = [];
  for (let i = start; i < lines.length; i++) {
    const parts = lines[i].split(",").map((p) => p.trim());
    const full_name = parts[0] ?? "";
    const email = parts[1] ?? "";
    if (!full_name) { rows.push({ full_name, email, error: "חסר שם" }); continue; }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { rows.push({ full_name, email, error: "אימייל לא תקין" }); continue; }
    rows.push({ full_name, email });
  }
  return rows;
}

export function ImportStudentsModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [classId, setClassId] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ results: any[]; success: number; failed: number } | null>(null);
  const importFn = useServerFn(importStudents);

  const classesQ = useQuery({ queryKey: ["classes"], queryFn: adminApi.listClasses });

  const valid = rows.filter((r) => !r.error);
  const invalid = rows.filter((r) => r.error);

  function downloadTemplate() {
    const csv = "full_name,email\nחיים כהן,haim@example.com\nשרה לוי,sara@example.com\n";
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "students-template.csv"; a.click();
    URL.revokeObjectURL(url);
  }

  async function onFile(f: File) {
    const text = await f.text();
    setRows(parseCsv(text));
    setResult(null);
  }

  async function runImport() {
    if (!classId) { toast.error("בחר כיתה"); return; }
    if (!valid.length) { toast.error("אין שורות תקינות"); return; }
    setBusy(true);
    try {
      const res = await importFn({ data: { class_id: classId, students: valid.map((r) => ({ full_name: r.full_name, email: r.email })) } });
      setResult(res as any);
      toast.success(`נוספו ${(res as any).success}, נכשלו ${(res as any).failed}`);
      qc.invalidateQueries({ queryKey: ["candidates"] });
    } catch (e: any) {
      toast.error(e.message ?? "ייבוא נכשל");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} dir="rtl" className="w-full max-w-3xl rounded-2xl border border-border bg-background p-5">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold">ייבוא תלמידים מ-CSV</h3>
          <button onClick={onClose} className="rounded-md p-1.5 text-muted-foreground hover:bg-accent"><X className="h-4 w-4" /></button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-semibold text-muted-foreground">בחר כיתה (כל התלמידים יוקצו אליה) *</label>
            <select value={classId} onChange={(e) => setClassId(e.target.value)} className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm">
              <option value="">— בחר כיתה —</option>
              {classesQ.data?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button onClick={() => fileRef.current?.click()} className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-gold px-4 text-sm font-semibold text-gold-foreground">
              <Upload className="h-4 w-4" /> בחר קובץ CSV
            </button>
            <input ref={fileRef} type="file" hidden accept=".csv,text/csv" onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }} />
            <button onClick={downloadTemplate} className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-border/60 px-4 text-sm">
              <Download className="h-4 w-4" /> הורד תבנית CSV
            </button>
            <span className="text-xs text-muted-foreground">פורמט: full_name,email</span>
          </div>

          {rows.length > 0 && !result && (
            <div className="space-y-2">
              <div className="text-sm">
                סך הכל: <b>{rows.length}</b> · תקינים: <b className="text-emerald-400">{valid.length}</b> · שגויים: <b className="text-rose-400">{invalid.length}</b>
              </div>
              <div className="max-h-[40vh] overflow-y-auto rounded-xl border border-border/60">
                <table className="w-full text-xs">
                  <thead className="bg-card/60 text-muted-foreground">
                    <tr><th className="px-2 py-1.5 text-right">שם</th><th className="px-2 py-1.5 text-right">אימייל</th><th className="px-2 py-1.5 text-right">סטטוס</th></tr>
                  </thead>
                  <tbody>
                    {rows.map((r, i) => (
                      <tr key={i} className="border-t border-border/40">
                        <td className="px-2 py-1.5">{r.full_name || "—"}</td>
                        <td className="px-2 py-1.5 text-muted-foreground">{r.email || "—"}</td>
                        <td className="px-2 py-1.5">
                          {r.error
                            ? <span className="text-rose-400">{r.error}</span>
                            : <span className="text-emerald-400">תקין</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {result && (
            <div className="space-y-2">
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-300">
                הצלחה: {result.success} · כישלונות: {result.failed}
              </div>
              <div className="max-h-[40vh] overflow-y-auto rounded-xl border border-border/60">
                <table className="w-full text-xs">
                  <thead className="bg-card/60 text-muted-foreground">
                    <tr><th className="px-2 py-1.5 text-right">שם</th><th className="px-2 py-1.5 text-right">אימייל</th><th className="px-2 py-1.5 text-right">תוצאה</th></tr>
                  </thead>
                  <tbody>
                    {result.results.map((r, i) => (
                      <tr key={i} className="border-t border-border/40">
                        <td className="px-2 py-1.5">{r.full_name}</td>
                        <td className="px-2 py-1.5 text-muted-foreground">{r.email}</td>
                        <td className="px-2 py-1.5">
                          {r.ok
                            ? <span className="inline-flex items-center gap-1 text-emerald-400"><CheckCircle2 className="h-3 w-3" /> נוסף</span>
                            : <span className="inline-flex items-center gap-1 text-rose-400"><XCircle className="h-3 w-3" /> {r.error}</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button onClick={onClose} className="rounded-lg border border-border/60 px-4 py-2 text-sm">סגור</button>
            {!result && (
              <button onClick={runImport} disabled={busy || !classId || !valid.length} className="rounded-lg bg-gold px-4 py-2 text-sm font-semibold text-gold-foreground disabled:opacity-50">
                {busy ? "מייבא…" : `ייבא ${valid.length} תלמידים`}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
