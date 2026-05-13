import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Phone, ShieldCheck, ArrowRight } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { LangSwitcher } from "@/components/LangSwitcher";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Sign in — Haile Drive AI" },
      { name: "description", content: "Sign in with your phone number to continue learning." },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const { t, dir } = useI18n();
  const navigate = useNavigate();
  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");

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
          <h1 className="text-2xl font-black tracking-tight">{t("login")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("welcome")}</p>

          {step === "phone" ? (
            <form
              onSubmit={(e) => { e.preventDefault(); if (phone.length >= 7) setStep("otp"); }}
              className="mt-6 space-y-4"
            >
              <label className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {t("phone")}
              </label>
              <div className="flex items-center gap-2 rounded-2xl border border-border bg-input px-4 py-3 focus-within:ring-2 focus-within:ring-gold/60">
                <Phone className="h-5 w-5 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">+972</span>
                <input
                  inputMode="tel"
                  autoFocus
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
                  placeholder="50 123 4567"
                  className="flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground/60"
                />
              </div>
              <button
                type="submit"
                disabled={phone.length < 7}
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-br from-gold to-amber-600 px-6 py-3.5 text-base font-semibold text-gold-foreground shadow-[var(--shadow-gold)] transition disabled:opacity-50"
              >
                {t("sendCode")} <ArrowRight className="h-4 w-4 rtl:rotate-180" />
              </button>
            </form>
          ) : (
            <form
              onSubmit={(e) => { e.preventDefault(); navigate({ to: "/dashboard" }); }}
              className="mt-6 space-y-4"
            >
              <label className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {t("enterOtp")}
              </label>
              <div className="flex items-center gap-2 rounded-2xl border border-border bg-input px-4 py-3 focus-within:ring-2 focus-within:ring-gold/60">
                <ShieldCheck className="h-5 w-5 text-muted-foreground" />
                <input
                  inputMode="numeric"
                  autoFocus
                  maxLength={6}
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                  placeholder="● ● ● ● ● ●"
                  className="flex-1 bg-transparent text-center text-2xl font-bold tracking-[0.6em] outline-none placeholder:text-muted-foreground/40"
                />
              </div>
              <button
                type="submit"
                disabled={otp.length < 4}
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-br from-gold to-amber-600 px-6 py-3.5 text-base font-semibold text-gold-foreground shadow-[var(--shadow-gold)] transition disabled:opacity-50"
              >
                {t("verify")} <ArrowRight className="h-4 w-4 rtl:rotate-180" />
              </button>
              <button
                type="button"
                onClick={() => setStep("phone")}
                className="block w-full text-center text-xs text-muted-foreground hover:text-foreground"
              >
                ← {t("phone")}
              </button>
            </form>
          )}
        </div>

        <p className="text-center text-xs text-muted-foreground">
          Demo mode — backend (Lovable Cloud) not yet connected.
        </p>
      </div>
    </div>
  );
}
