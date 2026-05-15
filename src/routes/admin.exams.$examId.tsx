import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AdminLoading, AdminShell } from "@/components/AdminShell";
import { adminApi } from "@/lib/admin-api";
import { useAuth } from "@/lib/auth";
import { Plus, Trash2, ChevronRight, Check } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/exams/$examId")({
  head: () => ({ meta: [{ title: "עריכת שאלות — Haile Drive AI" }] }),
  component: ExamEditor,
});

type DraftOption = { option_text: string; is_correct: boolean };
type Draft = { question_text: string; image_url: string | null; options: DraftOption[] };

const emptyDraft = (): Draft => ({
  question_text: "",
  image_url: null,
  options: [
    { option_text: "", is_correct: true },
    { option_text: "", is_correct: false },
    { option_text: "", is_correct: false },
    { option_text: "", is_correct: false },
  ],
});

function ExamEditor() {
  const { examId } = Route.useParams();
  const qc = useQueryClient();
  const { user, loading } = useAuth();
  const canQuery = !loading && !!user;
  const examQ = useQuery({ queryKey: ["exam", examId], queryFn: () => adminApi.getExam(examId), enabled: canQuery });
  const questionsQ = useQuery({ queryKey: ["questions", examId], queryFn: () => adminApi.listQuestions(examId), enabled: canQuery });
  const [draft, setDraft] = useState<Draft | null>(null);
  const [uploading, setUploading] = useState(false);

  const addMut = useMutation({
    mutationFn: (d: Draft) => adminApi.createQuestion({
      exam_id: examId,
      question_text: d.question_text,
      image_url: d.image_url,
      order_index: (questionsQ.data?.length ?? 0) + 1,
      options: d.options.filter((o) => o.option_text.trim()),
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["questions", examId] }); setDraft(null); toast.success("שאלה נוספה"); },
    onError: (e: any) => toast.error(e.message),
  });
  const delMut = useMutation({
    mutationFn: (id: string) => adminApi.deleteQuestion(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["questions", examId] }); toast.success("נמחק"); },
    onError: (e: any) => toast.error(e.message),
  });

  const handleImg = async (file: File) => {
    try {
      setUploading(true);
      const url = await adminApi.uploadMaterialFile(file);
      setDraft((d) => d ? { ...d, image_url: url } : d);
    } catch (e: any) { toast.error(e.message); }
    finally { setUploading(false); }
  };

  const submit = (d: Draft) => {
    if (!d.question_text.trim()) { toast.error("טקסט שאלה חובה"); return; }
    const valid = d.options.filter((o) => o.option_text.trim());
    if (valid.length < 2) { toast.error("לפחות 2 אפשרויות"); return; }
    if (!valid.some((o) => o.is_correct)) { toast.error("בחר תשובה נכונה"); return; }
    addMut.mutate(d);
  };
  const isLoading = examQ.isLoading || questionsQ.isLoading;
  const loadError = examQ.error || questionsQ.error;

  return (
    <AdminShell title={`עריכת שאלות — ${examQ.data?.title ?? ""}`}>
      <div className="mb-4 flex items-center gap-2 text-sm">
        <Link to="/admin/content" className="text-muted-foreground hover:text-foreground">בנק מבחנים</Link>
        <ChevronRight className="h-3 w-3 rotate-180 text-muted-foreground" />
        <span className="font-semibold">{examQ.data?.title}</span>
      </div>

      <button onClick={() => setDraft(emptyDraft())} className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-gold px-4 text-sm font-semibold text-gold-foreground">
        <Plus className="h-4 w-4" /> שאלה חדשה
      </button>

      {isLoading && <div className="mt-4"><AdminLoading label="טוען מבחן ושאלות מהמסד…" /></div>}
      {loadError && <div className="mt-4 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-300">טעינת הנתונים נכשלה: {(loadError as Error).message}</div>}

      <div className="mt-4 space-y-3">
        {!isLoading && questionsQ.data?.length === 0 && <div className="text-sm text-muted-foreground">אין שאלות עדיין.</div>}
        {questionsQ.data?.map((q, idx) => (
          <article key={q.id} className="rounded-2xl border border-border/60 bg-card/40 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">שאלה {idx + 1}</div>
                <p className="mt-1 font-semibold">{q.question_text}</p>
                {q.image_url && <img src={q.image_url} alt="" className="mt-2 max-h-40 rounded-lg" />}
                <ul className="mt-3 space-y-1.5">
                  {q.options.map((o) => (
                    <li key={o.id} className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm ${o.is_correct ? "border-emerald-500/40 bg-emerald-500/5 text-emerald-300" : "border-border/40 text-muted-foreground"}`}>
                      {o.is_correct && <Check className="h-3.5 w-3.5" />}
                      {o.option_text}
                    </li>
                  ))}
                </ul>
              </div>
              <button onClick={() => { if (confirm("למחוק שאלה?")) delMut.mutate(q.id); }} className="rounded-md p-1.5 text-rose-400 hover:bg-rose-500/10"><Trash2 className="h-3.5 w-3.5" /></button>
            </div>
          </article>
        ))}
      </div>

      {draft && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4" onClick={() => setDraft(null)}>
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-lg rounded-2xl border border-border bg-background p-5" dir="rtl">
            <h3 className="mb-4 text-lg font-bold">שאלה חדשה</h3>
            <form onSubmit={(e) => { e.preventDefault(); submit(draft); }} className="space-y-3">
              <label className="block">
                <span className="mb-1 block text-xs font-semibold">טקסט השאלה *</span>
                <textarea required value={draft.question_text} onChange={(e) => setDraft({ ...draft, question_text: e.target.value })} className="block w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-semibold">תמונה (אופציונלי)</span>
                <input type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && handleImg(e.target.files[0])} className="block w-full text-sm" />
                {uploading && <div className="text-xs text-muted-foreground">מעלה…</div>}
                {draft.image_url && <img src={draft.image_url} alt="" className="mt-2 max-h-32 rounded-lg" />}
              </label>
              <div>
                <div className="mb-1 text-xs font-semibold">אפשרויות (סמן את הנכונה)</div>
                <div className="space-y-2">
                  {draft.options.map((o, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <input type="radio" name="correct" checked={o.is_correct} onChange={() => setDraft({ ...draft, options: draft.options.map((x, j) => ({ ...x, is_correct: j === i })) })} />
                      <input value={o.option_text} onChange={(e) => setDraft({ ...draft, options: draft.options.map((x, j) => j === i ? { ...x, option_text: e.target.value } : x) })} placeholder={`אפשרות ${i + 1}`} className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm" />
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setDraft(null)} className="rounded-lg border border-border/60 px-4 py-2 text-sm">ביטול</button>
                <button type="submit" disabled={addMut.isPending || uploading} className="rounded-lg bg-gold px-4 py-2 text-sm font-semibold text-gold-foreground disabled:opacity-50">הוסף</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AdminShell>
  );
}
