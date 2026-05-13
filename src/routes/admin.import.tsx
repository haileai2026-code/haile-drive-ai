import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { AdminShell } from "@/components/AdminShell";
import { useStore } from "@/lib/data-store";
import {
  parseFile, autoMap, validate, exportRows,
  STUDENT_FIELDS, type StudentField, type ValidatedRow,
} from "@/lib/import-export";
import type { Candidate, CandidateStatus } from "@/lib/ops-data";
import {
  UploadCloud, FileSpreadsheet, CheckCircle2, AlertTriangle,
  Download, ArrowRight, X,
} from "lucide-react";

export const Route = createFileRoute("/admin/import")({
  head: () => ({ meta: [{ title: "Bulk Import — Haile Drive AI" }] }),
  component: ImportPage,
});

type Step = "upload" | "map" | "preview" | "done";

function ImportPage() {
  const store = useStore();
  const inputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [mapping, setMapping] = useState<Record<StudentField, string | null>>(
    {} as Record<StudentField, string | null>,
  );
  const [validated, setValidated] = useState<ValidatedRow[]>([]);
  const [result, setResult] = useState<{ added: number; skipped: number; failed: number } | null>(null);
  const [drag, setDrag] = useState(false);
  const [busy, setBusy] = useState(false);

  const handleFile = async (f: File) => {
    setBusy(true);
    try {
      setFile(f);
      const { headers, rows } = await parseFile(f);
      setHeaders(headers);
      setRows(rows);
      setMapping(autoMap(headers));
      setStep("map");
    } catch (e) {
      alert("Could not parse file: " + (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDrag(false);
    const f = e.dataTransfer.files?.[0]; if (f) handleFile(f);
  };

  const goPreview = () => {
    setValidated(validate(rows, mapping));
    setStep("preview");
  };

  const confirmImport = () => {
    const newCityIds = new Map<string, string>();
    for (const c of store.cities) newCityIds.set(c.name.toLowerCase(), c.id);

    const valid = validated.filter((v) => v.errors.length === 0);
    const candidates: Candidate[] = valid.map((v) => {
      const cityName = v.values.city!;
      const key = cityName.toLowerCase();
      let cityId = newCityIds.get(key);
      if (!cityId) {
        cityId = store.addCity(cityName).id;
        newCityIds.set(key, cityId);
      }
      const status = (v.values.status as CandidateStatus) || "new-lead";
      return {
        id: `cd-${Date.now()}-${v.index}`,
        name: v.values.name!,
        phone: v.values.phone!,
        cityId,
        language: v.values.language || "Amharic",
        status,
        tags: v.values.class ? [v.values.class] : [],
        notes: v.values.notes,
        createdAt: new Date().toISOString().slice(0, 10),
        timeline: [{ at: new Date().toISOString().slice(0, 10), event: "Imported from file" }],
      };
    });
    const r = store.addCandidates(candidates);
    setResult({ added: r.added, skipped: r.skipped, failed: validated.length - valid.length });
    setStep("done");
  };

  const reset = () => {
    setFile(null); setHeaders([]); setRows([]); setValidated([]);
    setMapping({} as Record<StudentField, string | null>); setResult(null); setStep("upload");
  };

  const downloadErrors = () => {
    const bad = validated.filter((v) => v.errors.length > 0);
    exportRows(
      bad.map((v) => ({ row: v.index + 2, errors: v.errors.join("; "), ...v.raw })),
      "import-errors", "csv",
    );
  };

  const downloadTemplate = () => {
    exportRows(
      [{ name: "Tesfaye Bekele", phone: "+972501112233", city: "Petah Tikva", branch: "Petah Tikva — Main", language: "Amharic", class: "", status: "new-lead", notes: "" }],
      "students-template", "xlsx",
    );
  };

  return (
    <AdminShell title="Bulk Import Students">
      <Stepper step={step} />

      {step === "upload" && (
        <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_320px]">
          <div
            onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
            onDragLeave={() => setDrag(false)}
            onDrop={onDrop}
            onClick={() => inputRef.current?.click()}
            className={`flex min-h-[280px] cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed p-10 text-center transition ${
              drag ? "border-gold bg-gold/5" : "border-border/60 bg-card/40 hover:border-gold/50"
            }`}
          >
            <UploadCloud className={`h-12 w-12 ${drag ? "text-gold" : "text-muted-foreground"}`} />
            <div className="mt-4 text-lg font-semibold">
              {busy ? "Reading file…" : "Drag & drop a file here"}
            </div>
            <div className="mt-1 text-sm text-muted-foreground">
              or click to browse. Supported: <code>.xlsx</code>, <code>.csv</code>
            </div>
            <input
              ref={inputRef} type="file" accept=".csv,.xlsx,.xls" hidden
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
            />
          </div>
          <aside className="rounded-2xl border border-border/60 bg-card/40 p-4">
            <h3 className="text-sm font-semibold">Need a template?</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Download a starter file with the right column names. Add your students and import.
            </p>
            <button
              onClick={downloadTemplate}
              className="mt-3 inline-flex h-9 w-full items-center justify-center gap-2 rounded-xl border border-gold/40 bg-gold/10 text-sm font-semibold text-gold"
            >
              <Download className="h-4 w-4" /> Download .xlsx template
            </button>
            <ul className="mt-4 space-y-1.5 text-xs text-muted-foreground">
              <li>• Name and phone are required</li>
              <li>• City auto-creates if not in system</li>
              <li>• Duplicate phones are skipped</li>
              <li>• Up to thousands of rows supported</li>
            </ul>
          </aside>
        </div>
      )}

      {step === "map" && (
        <div className="mt-6 rounded-2xl border border-border/60 bg-card/40 p-5">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 text-sm">
                <FileSpreadsheet className="h-4 w-4 text-gold" />
                <span className="font-semibold">{file?.name}</span>
                <span className="text-muted-foreground">· {rows.length} rows · {headers.length} columns</span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">Map columns from your file to student fields.</p>
            </div>
            <button onClick={reset} className="text-xs text-muted-foreground hover:text-foreground">
              <X className="inline h-3.5 w-3.5" /> Cancel
            </button>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {STUDENT_FIELDS.map((f) => (
              <label key={f} className="block">
                <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {f} {(f === "name" || f === "phone" || f === "city") && <span className="text-rose-400">*</span>}
                </div>
                <select
                  value={mapping[f] ?? ""}
                  onChange={(e) => setMapping((m) => ({ ...m, [f]: e.target.value || null }))}
                  className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm"
                >
                  <option value="">— ignore —</option>
                  {headers.map((h) => <option key={h} value={h}>{h}</option>)}
                </select>
              </label>
            ))}
          </div>
          <div className="mt-5 flex justify-end">
            <button
              onClick={goPreview}
              disabled={!mapping.name || !mapping.phone || !mapping.city}
              className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-gold px-4 text-sm font-semibold text-gold-foreground disabled:opacity-50"
            >
              Preview & validate <ArrowRight className="h-4 w-4 rtl:rotate-180" />
            </button>
          </div>
        </div>
      )}

      {step === "preview" && (
        <PreviewStep
          validated={validated}
          onBack={() => setStep("map")}
          onConfirm={confirmImport}
          onDownloadErrors={downloadErrors}
        />
      )}

      {step === "done" && result && (
        <div className="mt-6 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-8 text-center">
          <CheckCircle2 className="mx-auto h-14 w-14 text-emerald-400" />
          <h2 className="mt-4 text-2xl font-bold">Import complete</h2>
          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            <Stat label="Added" value={result.added} tone="success" />
            <Stat label="Skipped (duplicates)" value={result.skipped} tone="warn" />
            <Stat label="Failed (invalid)" value={result.failed} tone="danger" />
          </div>
          <div className="mt-6 flex justify-center gap-2">
            <button onClick={reset} className="rounded-xl border border-border/60 px-4 py-2 text-sm">
              Import another file
            </button>
            <a href="/admin/candidates" className="rounded-xl bg-gold px-4 py-2 text-sm font-semibold text-gold-foreground">
              View candidates
            </a>
          </div>
        </div>
      )}
    </AdminShell>
  );
}

function Stepper({ step }: { step: Step }) {
  const steps: { id: Step; label: string }[] = [
    { id: "upload", label: "1. Upload" },
    { id: "map", label: "2. Map columns" },
    { id: "preview", label: "3. Preview" },
    { id: "done", label: "4. Done" },
  ];
  const idx = steps.findIndex((s) => s.id === step);
  return (
    <div className="flex flex-wrap gap-2">
      {steps.map((s, i) => (
        <span
          key={s.id}
          className={`rounded-full border px-3 py-1 text-xs ${
            i < idx ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
              : i === idx ? "border-gold/40 bg-gold/15 text-gold"
              : "border-border/60 text-muted-foreground"
          }`}
        >{s.label}</span>
      ))}
    </div>
  );
}

function PreviewStep({
  validated, onBack, onConfirm, onDownloadErrors,
}: {
  validated: ValidatedRow[];
  onBack: () => void; onConfirm: () => void; onDownloadErrors: () => void;
}) {
  const valid = validated.filter((v) => v.errors.length === 0).length;
  const bad = validated.length - valid;
  const sample = validated.slice(0, 50);
  return (
    <div className="mt-6 space-y-4">
      <div className="grid gap-2 sm:grid-cols-3">
        <Stat label="Total rows" value={validated.length} />
        <Stat label="Ready to import" value={valid} tone="success" />
        <Stat label="Errors" value={bad} tone={bad ? "danger" : "default"} />
      </div>
      {bad > 0 && (
        <div className="flex items-center justify-between rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 text-sm">
          <div className="flex items-center gap-2 text-amber-300">
            <AlertTriangle className="h-4 w-4" /> {bad} row(s) have errors and will be skipped.
          </div>
          <button onClick={onDownloadErrors} className="text-xs font-semibold text-amber-300 hover:underline">
            Download error report
          </button>
        </div>
      )}
      <div className="overflow-x-auto rounded-2xl border border-border/60 bg-card/40">
        <table className="w-full text-sm">
          <thead className="bg-background/40 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-3 py-2">#</th>
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">Phone</th>
              <th className="px-3 py-2">City</th>
              <th className="px-3 py-2">Language</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Issues</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {sample.map((v) => (
              <tr key={v.index} className={v.errors.length ? "bg-rose-500/5" : ""}>
                <td className="px-3 py-2 text-muted-foreground">{v.index + 2}</td>
                <td className="px-3 py-2 font-medium">{v.values.name || "—"}</td>
                <td className="px-3 py-2">{v.values.phone || "—"}</td>
                <td className="px-3 py-2">{v.values.city || "—"}</td>
                <td className="px-3 py-2">{v.values.language || "—"}</td>
                <td className="px-3 py-2">{v.values.status || "new-lead"}</td>
                <td className="px-3 py-2">
                  {v.errors.length === 0
                    ? <span className="text-xs text-emerald-300">OK</span>
                    : <span className="text-xs text-rose-300">{v.errors.join(", ")}</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {validated.length > 50 && (
          <div className="border-t border-border/40 p-2 text-center text-xs text-muted-foreground">
            Showing first 50 of {validated.length} rows.
          </div>
        )}
      </div>
      <div className="flex justify-between">
        <button onClick={onBack} className="rounded-xl border border-border/60 px-4 py-2 text-sm">
          Back
        </button>
        <button
          onClick={onConfirm} disabled={valid === 0}
          className="rounded-xl bg-gold px-5 py-2 text-sm font-semibold text-gold-foreground disabled:opacity-50"
        >
          Import {valid} student{valid === 1 ? "" : "s"}
        </button>
      </div>
    </div>
  );
}

function Stat({
  label, value, tone = "default",
}: { label: string; value: number; tone?: "default" | "success" | "warn" | "danger" }) {
  const cls = {
    default: "border-border/60",
    success: "border-emerald-500/30 bg-emerald-500/5 text-emerald-300",
    warn: "border-amber-500/30 bg-amber-500/5 text-amber-300",
    danger: "border-rose-500/30 bg-rose-500/5 text-rose-300",
  }[tone];
  return (
    <div className={`rounded-2xl border p-4 ${cls}`}>
      <div className="text-[11px] uppercase tracking-wider opacity-80">{label}</div>
      <div className="mt-1 text-3xl font-black">{value}</div>
    </div>
  );
}
