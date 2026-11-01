import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { fetchConsentState, withdrawConsent } from "@/lib/consent/api";
import { needsRequiredConsent, partnerSharingGranted } from "@/lib/consent/versions";

// Minimal consent withdrawal (Hebrew only). Withdrawal appends a row with
// granted=false; history is never changed. Withdrawing the required consent
// re-opens the consent form (ConsentGate) and blocks the student screens.
type Kind = "partner_individual_progress" | "privacy_terms_abroad";

export function ConsentWithdrawal() {
  const { user, role } = useAuth();
  const applies = !!user && (role === "student" || role === "lead");
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const { data } = useQuery({
    queryKey: ["consent-state", user?.id],
    enabled: applies,
    queryFn: () => fetchConsentState(user!.id),
  });
  if (!applies || !data) return null;

  const partner = partnerSharingGranted(data.partner);
  const required = !needsRequiredConsent(data.required);

  async function withdraw(kind: Kind) {
    if (kind === "privacy_terms_abroad" &&
        !window.confirm("ביטול ההסכמה יחסום את השימוש בקמפוס עד לאישור מחדש. להמשיך?")) return;
    setBusy(true);
    setMsg(null);
    try {
      await withdrawConsent(kind, "he");
      setMsg("ההסכמה בוטלה ונרשמה.");
      await qc.invalidateQueries({ queryKey: ["consent-state", user!.id] });
    } catch {
      setMsg("לא ניתן היה לבטל את ההסכמה. נסו שוב.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section dir="rtl" lang="he" className="mt-6 space-y-3 rounded-2xl border border-border/70 bg-card/50 p-4 text-sm">
      <h2 className="font-bold">ההסכמות שלי</h2>
      {partner && (
        <button type="button" disabled={busy} onClick={() => withdraw("partner_individual_progress")}
          className="w-full rounded-xl border border-border/60 px-3 py-2 text-start hover:bg-card disabled:opacity-50">
          ביטול הסכמה לשיתוף ההתקדמות האישית עם שותפים
        </button>
      )}
      {required && (
        <button type="button" disabled={busy} onClick={() => withdraw("privacy_terms_abroad")}
          className="w-full rounded-xl border border-destructive/40 px-3 py-2 text-start text-destructive hover:bg-destructive/10 disabled:opacity-50">
          ביטול ההסכמה לתנאי השימוש ולמדיניות הפרטיות
        </button>
      )}
      {msg && <p role="status" className="text-xs text-muted-foreground">{msg}</p>}
    </section>
  );
}
