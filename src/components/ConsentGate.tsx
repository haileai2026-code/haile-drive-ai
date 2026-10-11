import { useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import ReactMarkdown from "react-markdown";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { getConsentContent } from "@/lib/consent/i18n";
import { fetchConsentState, recordConsent } from "@/lib/consent/api";
import { needsRequiredConsent } from "@/lib/consent/versions";

// Blocks student/lead screens until the required consent (checkbox 1) is
// recorded for the CURRENT notice / terms / checkbox versions. Checkbox 2 is
// optional and never blocks. Checkbox 3 is hidden in the beta.
export function ConsentGate({ children }: { children: ReactNode }) {
  const { user, role } = useAuth();
  const applies = !!user && (role === "student" || role === "lead");
  const { data, isLoading, isError } = useQuery({
    queryKey: ["consent-state", user?.id],
    enabled: applies,
    queryFn: () => fetchConsentState(user!.id),
  });
  if (!applies) return <>{children}</>;
  if (isLoading) return null;
  if (isError || !data || needsRequiredConsent(data.required)) {
    return <ConsentForm userId={user!.id} hasPartnerRecord={!!data?.partner} />;
  }
  return <>{children}</>;
}

function ConsentForm({ userId, hasPartnerRecord }: { userId: string; hasPartnerRecord: boolean }) {
  const { lang } = useI18n();
  const c = getConsentContent(lang);
  const qc = useQueryClient();
  const [cb1, setCb1] = useState(false); // never pre-ticked
  const [cb2, setCb2] = useState(false); // never pre-ticked
  const [open, setOpen] = useState<"notice" | "terms" | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    if (!cb1) return;
    setBusy(true);
    setErr(null);
    try {
      await recordConsent({ userId, language: c.language, partnerTicked: cb2, hasPartnerRecord });
      await qc.invalidateQueries({ queryKey: ["consent-state", userId] });
    } catch {
      setErr(c.ui.error);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div dir={c.dir} lang={c.language} className="mx-auto max-w-xl space-y-4">
      <div className="rounded-lg border border-amber-400/40 bg-amber-400/10 px-3 py-1.5 text-center text-xs text-amber-300">
        {c.ui.draftBanner}
      </div>
      <h1 className="text-xl font-black">{c.ui.title}</h1>
      <p className="text-sm text-muted-foreground">{c.ui.intro}</p>

      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => setOpen(open === "notice" ? null : "notice")} className="rounded-lg border border-border/60 px-3 py-1.5 text-xs text-gold hover:bg-gold/10">
          {open === "notice" ? c.ui.hide : c.ui.readNotice}
        </button>
        <button type="button" onClick={() => setOpen(open === "terms" ? null : "terms")} className="rounded-lg border border-border/60 px-3 py-1.5 text-xs text-gold hover:bg-gold/10">
          {open === "terms" ? c.ui.hide : c.ui.readTerms}
        </button>
      </div>
      {open && (
        <div className="prose prose-invert prose-sm max-h-80 overflow-y-auto rounded-xl border border-border/60 bg-card/50 p-4 text-sm leading-relaxed">
          <ReactMarkdown>{open === "notice" ? c.noticeMd : c.termsMd}</ReactMarkdown>
        </div>
      )}

      <label className="flex items-start gap-3 rounded-xl border border-gold/40 bg-card/60 p-4 text-sm">
        <input type="checkbox" checked={cb1} onChange={(e) => setCb1(e.target.checked)} className="mt-1 h-4 w-4" />
        <span>
          <span className="me-2 rounded bg-gold/15 px-1.5 py-0.5 text-[10px] font-bold text-gold">{c.ui.required}</span>
          {c.checkbox1}
        </span>
      </label>

      <label className="flex items-start gap-3 rounded-xl border border-border/60 bg-card/30 p-4 text-sm">
        <input type="checkbox" checked={cb2} onChange={(e) => setCb2(e.target.checked)} className="mt-1 h-4 w-4" />
        <span>
          <span className="me-2 rounded bg-muted px-1.5 py-0.5 text-[10px] font-bold text-muted-foreground">{c.ui.optional}</span>
          {c.checkbox2}
        </span>
      </label>

      {err && <p className="text-sm text-rose-400">{err}</p>}
      <button
        type="button"
        disabled={!cb1 || busy}
        onClick={submit}
        className="w-full rounded-xl bg-gold py-3 text-sm font-bold text-gold-foreground disabled:opacity-40"
      >
        {busy ? c.ui.saving : c.ui.continue}
      </button>
    </div>
  );
}
