import { createFileRoute, useNavigate, Link, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { Mail, Lock, ArrowRight, User as UserIcon, Crown, GraduationCap, BookOpen, Phone, KeyRound } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { useI18n } from "@/lib/i18n";
import { LangSwitcher } from "@/components/LangSwitcher";
import { getPrimaryRole, useAuth, roleHomePath } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { requestPhoneOtp, verifyPhoneOtp } from "@/lib/phone-login.functions";
import type { Role } from "@/lib/ops-data";

type PortalRole = Extract<Role, "owner" | "teacher" | "student">;

const PORTALS: Record<PortalRole, {
  label: string;
  labelHe: string;
  icon: typeof Crown;
  accent: string;
  ring: string;
  badge: string;
  gradient: string;
  description: string;
}> = {
  owner: {
    label: "Owner",
    labelHe: "בעלים",
    icon: Crown,
    accent: "text-amber-300",
    ring: "ring-amber-400/60",
    badge: "bg-amber-500/15 text-amber-300 border-amber-400/40",
    gradient: "from-amber-500 to-yellow-600",
    description: "כניסת בעלים — גישה מלאה לכל המודולים",
  },
  teacher: {
    label: "Teacher",
    labelHe: "מרצה",
    icon: BookOpen,
    accent: "text-sky-300",
    ring: "ring-sky-400/60",
    badge: "bg-sky-500/15 text-sky-300 border-sky-400/40",
    gradient: "from-sky-500 to-blue-600",
    description: "Teacher portal — manage classes & attendance",
  },
  student: {
    label: "Student",
    labelHe: "תלמיד",
    icon: GraduationCap,
    accent: "text-emerald-300",
    ring: "ring-emerald-400/60",
    badge: "bg-emerald-500/15 text-emerald-300 border-emerald-400/40",
    gradient: "from-emerald-500 to-green-600",
    description: "Student portal — lessons, quizzes, progress",
  },
};

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
      const role = await getPrimaryRole(data.session.user.id);
      throw redirect({ to: roleHomePath(role) });
    }
  },
  component: LoginPage,
});

function LoginPage() {
  const { t, dir } = useI18n();
  const navigate = useNavigate();
  const { signIn, signUp, refresh } = useAuth();
  const [portal, setPortal] = useState<PortalRole>("owner");
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [authMethod, setAuthMethod] = useState<"email" | "phone">("email");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Phone login state
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const requestOtpFn = useServerFn(requestPhoneOtp);
  const verifyOtpFn = useServerFn(verifyPhoneOtp);

  const sendOtp = async () => {
    setErr(null); setInfo(null);
    if (!phone || phone.replace(/\D/g, "").length < 6) {
      setErr("הזן/י מספר טלפון תקין");
      return;
    }
    setBusy(true);
    try {
      await requestOtpFn({ data: { phone } });
      setOtpSent(true);
      setInfo("הקוד נשלח — המתן לאישור מנהל ואז הזן/י את הקוד");
    } catch (e: any) {
      setErr(e?.message ?? "שגיאה בשליחת הקוד");
    } finally { setBusy(false); }
  };

  const submitPhone = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    if (!/^\d{6}$/.test(otp)) { setErr("הזן/י קוד בן 6 ספרות"); return; }
    setBusy(true);
    try {
      const res = await verifyOtpFn({ data: { phone, otp } });
      const r = await signIn(res.email, res.password);
      if (r.error) { setErr(r.error); return; }
      await new Promise((rs) => setTimeout(rs, 300));
      await refresh();
      const { data } = await supabase.auth.getUser();
      if (!data.user) return;
      const actualRole = await getPrimaryRole(data.user.id);
      navigate({ to: roleHomePath(actualRole) });
    } catch (err: any) {
      setErr(err?.message ?? "קוד שגוי או בקשה ממתינה לאישור");
    } finally { setBusy(false); }
  };

  const sendReset = async () => {
    setErr(null); setInfo(null);
    if (!email) { setErr("הזן/י כתובת אימייל לשחזור"); return; }
    setBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setBusy(false);
    if (error) { setErr(error.message); return; }
    setInfo("שלחנו קישור לאיפוס סיסמה למייל שלך. בדוק/י גם בתיקיית הספאם.");
  };

  const portalCfg = PORTALS[portal];
  const PortalIcon = portalCfg.icon;
  const isOwnerPortal = portal === "owner";
  // Owner portal is sign-in only (owner is provisioned via the hard-set email).
  const effectiveMode: "signin" | "signup" = isOwnerPortal ? "signin" : mode;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    const res = effectiveMode === "signin"
      ? await signIn(email, password)
      : await signUp(email, password, fullName);
    if (res.error) { setBusy(false); setErr(res.error); return; }

    // wait briefly for session/role hydration
    await new Promise((r) => setTimeout(r, 350));
    await refresh();
    const { data } = await supabase.auth.getUser();
    if (!data.user) { setBusy(false); return; }
    const actualRole = await getPrimaryRole(data.user.id);

    // Always route to the user's actual role home — the portal tab is only a visual entry point.
    setBusy(false);
    navigate({ to: roleHomePath(actualRole) });
  };

  return (
    <div className="min-h-screen bg-night px-5 py-10" dir={dir}>
      <div className="mx-auto flex max-w-md flex-col gap-6">
        <div className="flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-gold to-amber-600 text-gold-foreground font-black">H</span>
            <span className="text-sm font-semibold">{t("appName")}</span>
          </Link>
          <LangSwitcher />
        </div>

        {/* Portal selector */}
        <div>
          <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            בחר/י סוג חשבון · Choose portal
          </div>
          <div className="grid grid-cols-3 gap-2">
            {(Object.keys(PORTALS) as PortalRole[]).map((key) => {
              const cfg = PORTALS[key];
              const Icon = cfg.icon;
              const active = portal === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => { setPortal(key); setErr(null); }}
                  className={`flex flex-col items-center gap-1.5 rounded-2xl border p-3 text-center transition ${
                    active
                      ? `border-transparent bg-gradient-to-br ${cfg.gradient} text-white shadow-lg ring-2 ${cfg.ring}`
                      : "border-border/70 bg-card/40 text-muted-foreground hover:bg-card/70"
                  }`}
                >
                  <Icon className="h-5 w-5" />
                  <span className="text-[11px] font-semibold leading-tight">
                    {cfg.labelHe}
                    <br />
                    <span className="opacity-70">{cfg.label}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="rounded-3xl border border-border/70 bg-card/60 p-6 shadow-[var(--shadow-elev)] backdrop-blur">
          <div className={`mb-4 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${portalCfg.badge}`}>
            <PortalIcon className="h-3.5 w-3.5" />
            {portalCfg.labelHe} · {portalCfg.label}
          </div>

          {/* Auth method tabs: email vs phone (phone hidden for owner portal) */}
          {!isOwnerPortal && (
            <div className="mb-3 flex gap-2 rounded-xl bg-background/50 p-1">
              <button
                type="button"
                onClick={() => { setAuthMethod("email"); setErr(null); setInfo(null); }}
                className={`flex-1 rounded-lg py-2 text-xs font-semibold ${authMethod === "email" ? "bg-gold/15 text-gold" : "text-muted-foreground"}`}
              >אימייל · Email</button>
              <button
                type="button"
                onClick={() => { setAuthMethod("phone"); setErr(null); setInfo(null); }}
                className={`flex-1 rounded-lg py-2 text-xs font-semibold ${authMethod === "phone" ? "bg-gold/15 text-gold" : "text-muted-foreground"}`}
              >כניסה במספר טלפון · በስልክ ቁጥር ግባ</button>
            </div>
          )}

          {!isOwnerPortal && authMethod === "email" && (
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
          )}

          <h1 className="mt-5 text-2xl font-black tracking-tight">
            {authMethod === "phone" && !isOwnerPortal
              ? "כניסה במספר טלפון"
              : effectiveMode === "signin" ? t("login") : "Create account"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{portalCfg.description}</p>

          {(isOwnerPortal || authMethod === "email") ? (
            <form onSubmit={submit} className="mt-6 space-y-3">
              {effectiveMode === "signup" && (
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
                  autoComplete={effectiveMode === "signin" ? "current-password" : "new-password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password"
                  className="flex-1 bg-transparent text-base outline-none"
                />
              </div>

              {effectiveMode === "signin" && (
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={sendReset}
                    disabled={busy}
                    className="text-xs font-semibold text-gold hover:underline disabled:opacity-50"
                  >
                    שכחת סיסמה? שלח/י קוד אימות
                  </button>
                </div>
              )}

              {err && <p className="text-sm text-rose-400">{err}</p>}
              {info && <p className="text-sm text-emerald-400">{info}</p>}

              <button
                type="submit"
                disabled={busy}
                className={`inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-br ${portalCfg.gradient} px-6 py-3.5 text-base font-semibold text-white shadow-lg disabled:opacity-50`}
              >
                {busy ? "..." : effectiveMode === "signin" ? `${t("login")} · ${portalCfg.labelHe}` : `Create ${portalCfg.label} account`}
                <ArrowRight className="h-4 w-4 rtl:rotate-180" />
              </button>
            </form>
          ) : (
            <form onSubmit={submitPhone} className="mt-6 space-y-3">
              <div className="flex items-center gap-2 rounded-2xl border border-border bg-input px-4 py-3">
                <Phone className="h-5 w-5 text-muted-foreground" />
                <input
                  type="tel"
                  required
                  autoComplete="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="0501234567"
                  className="flex-1 bg-transparent text-base outline-none"
                  disabled={otpSent}
                />
              </div>

              {!otpSent ? (
                <button
                  type="button"
                  onClick={sendOtp}
                  disabled={busy}
                  className={`inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-br ${portalCfg.gradient} px-6 py-3.5 text-base font-semibold text-white shadow-lg disabled:opacity-50`}
                >
                  {busy ? "..." : "שלח קוד · ላክ ኮድ"}
                </button>
              ) : (
                <>
                  <div className="flex items-center gap-2 rounded-2xl border border-border bg-input px-4 py-3">
                    <KeyRound className="h-5 w-5 text-muted-foreground" />
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="\d{6}"
                      maxLength={6}
                      required
                      value={otp}
                      onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                      placeholder="קוד בן 6 ספרות"
                      className="flex-1 bg-transparent text-base tracking-widest outline-none"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => { setOtpSent(false); setOtp(""); setInfo(null); setErr(null); }}
                    className="text-xs text-muted-foreground hover:underline"
                  >שנה מספר טלפון</button>
                </>
              )}

              {err && <p className="text-sm text-rose-400">{err}</p>}
              {info && <p className="text-sm text-emerald-400">{info}</p>}

              {otpSent && (
                <button
                  type="submit"
                  disabled={busy}
                  className={`inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-br ${portalCfg.gradient} px-6 py-3.5 text-base font-semibold text-white shadow-lg disabled:opacity-50`}
                >
                  {busy ? "..." : "אמת והיכנס · አረጋግጥ"}
                  <ArrowRight className="h-4 w-4 rtl:rotate-180" />
                </button>
              )}
            </form>
          )}
        </div>

        {isOwnerPortal && (
          <p className="text-center text-xs text-muted-foreground">
            כניסת בעלים — הרשאה ניתנת ידנית דרך ניהול משתמשים
          </p>
        )}
      </div>
    </div>
  );
}
