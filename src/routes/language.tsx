import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useI18n } from "@/lib/i18n";
import { Check, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/language")({
  head: () => ({ meta: [{ title: "Choose your language — Haile Drive AI" }] }),
  component: LanguagePicker,
});

function LanguagePicker() {
  const { lang, setLang, t, languages, dir } = useI18n();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-night px-5 py-10" dir={dir}>
      <div className="mx-auto max-w-md">
        <Link to="/" className="text-xs text-muted-foreground hover:text-gold">← Home</Link>

        <div className="mt-6 text-center">
          <span className="grid mx-auto h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-gold to-amber-600 text-2xl font-black text-gold-foreground shadow-[var(--shadow-gold)]">
            🌐
          </span>
          <h1 className="mt-4 text-3xl font-black tracking-tight">{t("chooseLanguage")}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{t("chooseLanguageHint")}</p>
        </div>

        <ul className="mt-8 grid grid-cols-2 gap-3">
          {languages.map((l) => {
            const active = l.code === lang;
            const isBeta = l.coverage < 60;
            return (
              <li key={l.code}>
                <button
                  onClick={() => setLang(l.code)}
                  className={`relative flex h-32 w-full flex-col items-center justify-center gap-2 rounded-2xl border p-4 text-center transition ${
                    active ? "border-gold bg-gold/10 ring-gold" : "border-border/70 bg-card/50 hover:border-gold/40"
                  }`}
                  dir={l.dir}
                >
                  <span className="text-4xl leading-none">{l.flag}</span>
                  <span className="text-base font-bold">{l.nativeName}</span>
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{l.name}</span>
                  {active && (
                    <span className="absolute end-2 top-2 grid h-6 w-6 place-items-center rounded-full bg-gold text-gold-foreground">
                      <Check className="h-3.5 w-3.5" />
                    </span>
                  )}
                  {isBeta && (
                    <span className="absolute start-2 top-2 rounded-full bg-amber-500/20 px-2 py-0.5 text-[9px] font-semibold uppercase text-amber-300">
                      {t("beta")} · {l.coverage}%
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>

        <button
          onClick={() => navigate({ to: "/dashboard" })}
          className="mt-8 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-br from-gold to-amber-600 px-6 py-4 text-base font-bold text-gold-foreground shadow-[var(--shadow-gold)]"
        >
          {t("continueIn")} {languages.find((l) => l.code === lang)?.nativeName}
          <ArrowRight className="h-5 w-5 rtl:rotate-180" />
        </button>
      </div>
    </div>
  );
}
