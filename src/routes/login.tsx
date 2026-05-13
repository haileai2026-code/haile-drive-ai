import { createFileRoute, useNavigate, Link, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { Mail, Lock, ArrowRight, User as UserIcon } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { LangSwitcher } from "@/components/LangSwitcher";
import { useAuth, roleHomePath } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Sign in — Haile Drive AI" },
      { name: "description", content: "Sign in to your Haile Drive AI account." },
    ],
  }),
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (data.session) {
      const { data: role } = await supabase.rpc("get_primary_role", { _user_id: data.session.user.id });
      throw redirect({ to: roleHomePath((role as any) ?? "student") });
    }
  },
  component: LoginPage,
});

function LoginPage() {
  const { t, dir } = useI18n();
  const navigate = useNavigate();
  const { signIn, signUp, refresh } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    const res = mode === "signin"
      ? await signIn(email, password)
      : await signUp(email, password, fullName);
    setBusy(false);
    if (res.error) { setErr(res.error); return; }
    // wait briefly for profile/role to hydrate
    await new Promise((r) => setTimeout(r, 300));
    await refresh();
    const { data } = await supabase.auth.getUser();
    if (!data.user) return;
    const { data: primary } = await supabase.rpc("get_primary_role", { _user_id: data.user.id });
    const role = ((primary as any) ?? "student") as any;
    navigate({ to: roleHomePath(role) });
  };

  return (
    <div className="min-h-screen bg-night px-5 py-10" dir={dir}>
      <div className="mx-auto flex max-w-md flex-col gap-8">
        <div className="flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-gold to-amber-600 text-gold-foreground font-black">H</span>
            <span className="text-sm font-semibold">{t("appName")}</span>
          </Link>
          <LangSwitcher />
        </div>

        <div className="rounded-3xl border border-border/70 bg-card/60 p-6 shadow-[var(--shadow-elev)] backdrop-blur">
          <div className="flex gap-2 rounded-xl bg-background/50 p-1">
            <button
              type="button"
              onClick={() => setMode("signin")}
              className={`flex-1 rounded-lg py-2 text-sm font-semibold ${mode === "signin" ? "bg-gold/15 text-gold" : "text-muted-foreground"}`}
            >Sign in</button>
            <button
              type="button"
              onClick={() => setMode("signup")}
              className={`flex-1 rounded-lg py-2 text-sm font-semibold ${mode === "signup" ? "bg-gold/15 text-gold" : "text-muted-foreground"}`}
            >Sign up</button>
          </div>

          <h1 className="mt-5 text-2xl font-black tracking-tight">
            {mode === "signin" ? t("login") : "Create account"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("welcome")}</p>

          <form onSubmit={submit} className="mt-6 space-y-3">
            {mode === "signup" && (
              <div className="flex items-center gap-2 rounded-2xl border border-border bg-input px-4 py-3">
                <UserIcon className="h-5 w-5 text-muted-foreground" />
                <input
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Full name"
                  className="flex-1 bg-transparent text-base outline-none"
                />
              </div>
            )}
            <div className="flex items-center gap-2 rounded-2xl border border-border bg-input px-4 py-3">
              <Mail className="h-5 w-5 text-muted-foreground" />
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="flex-1 bg-transparent text-base outline-none"
              />
            </div>
            <div className="flex items-center gap-2 rounded-2xl border border-border bg-input px-4 py-3">
              <Lock className="h-5 w-5 text-muted-foreground" />
              <input
                type="password"
                required
                minLength={6}
                autoComplete={mode === "signin" ? "current-password" : "new-password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                className="flex-1 bg-transparent text-base outline-none"
              />
            </div>

            {err && <p className="text-sm text-rose-400">{err}</p>}

            <button
              type="submit"
              disabled={busy}
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-br from-gold to-amber-600 px-6 py-3.5 text-base font-semibold text-gold-foreground shadow-[var(--shadow-gold)] disabled:opacity-50"
            >
              {busy ? "..." : mode === "signin" ? t("login") : "Create account"}
              <ArrowRight className="h-4 w-4 rtl:rotate-180" />
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-muted-foreground">
          Owner email <span className="font-mono text-gold">haileai.2026@gmail.com</span> auto-receives full access on signup.
        </p>
      </div>
    </div>
  );
}
