import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Lock, ArrowRight, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Reset password — Haile Drive AI" },
      { name: "description", content: "Set a new password for your account." },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [hasSession, setHasSession] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    // Supabase fires PASSWORD_RECOVERY when the user lands from the email link
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || session) setHasSession(!!session);
    });
    supabase.auth.getSession().then(({ data }) => {
      setHasSession(!!data.session);
      setReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    if (password.length < 6) { setErr("הסיסמה חייבת להיות באורך 6 תווים לפחות"); return; }
    if (password !== confirm) { setErr("הסיסמאות אינן תואמות"); return; }
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) { setErr(error.message); return; }
    setDone(true);
    setTimeout(() => navigate({ to: "/login" }), 1800);
  };

  return (
    <div className="min-h-screen bg-night px-5 py-10" dir="rtl">
      <div className="mx-auto max-w-md">
        <div className="rounded-3xl border border-border/70 bg-card/60 p-6 shadow-[var(--shadow-elev)] backdrop-blur">
          <h1 className="text-2xl font-black tracking-tight">איפוס סיסמה</h1>
          <p className="mt-1 text-sm text-muted-foreground">בחר/י סיסמה חדשה לחשבון שלך.</p>

          {!ready ? (
            <p className="mt-6 text-sm text-muted-foreground">טוען…</p>
          ) : done ? (
            <div className="mt-6 flex flex-col items-center gap-2 text-emerald-400">
              <CheckCircle2 className="h-10 w-10" />
              <p className="text-sm">הסיסמה עודכנה. מעביר/ה לדף ההתחברות…</p>
            </div>
          ) : !hasSession ? (
            <div className="mt-6 space-y-3">
              <p className="text-sm text-rose-400">
                הקישור פג תוקף או אינו תקין. בקש/י קישור חדש מדף ההתחברות.
              </p>
              <Link to="/login" className="inline-flex text-sm font-semibold text-gold hover:underline">
                חזרה להתחברות
              </Link>
            </div>
          ) : (
            <form onSubmit={submit} className="mt-6 space-y-3">
              <div className="flex items-center gap-2 rounded-2xl border border-border bg-input px-4 py-3">
                <Lock className="h-5 w-5 text-muted-foreground" />
                <input
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="סיסמה חדשה"
                  className="flex-1 bg-transparent text-base outline-none"
                />
              </div>
              <div className="flex items-center gap-2 rounded-2xl border border-border bg-input px-4 py-3">
                <Lock className="h-5 w-5 text-muted-foreground" />
                <input
                  type="password"
                  required
                  minLength={6}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="אישור סיסמה"
                  className="flex-1 bg-transparent text-base outline-none"
                />
              </div>
              {err && <p className="text-sm text-rose-400">{err}</p>}
              <button
                type="submit"
                disabled={busy}
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-br from-amber-500 to-yellow-600 px-6 py-3.5 text-base font-semibold text-white shadow-lg disabled:opacity-50"
              >
                {busy ? "מעדכן…" : "עדכן/י סיסמה"}
                <ArrowRight className="h-4 w-4 rtl:rotate-180" />
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
