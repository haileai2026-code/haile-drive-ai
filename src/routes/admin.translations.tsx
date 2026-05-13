import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { useI18n } from "@/lib/i18n";
import { LANGUAGES } from "@/lib/languages";
import { Plus, Upload, Mic2, FileText } from "lucide-react";

export const Route = createFileRoute("/admin/translations")({
  head: () => ({ meta: [{ title: "Translations — Admin" }] }),
  component: AdminTranslations,
});

function AdminTranslations() {
  const { t } = useI18n();

  return (
    <AppShell>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-wider text-gold">{t("admin")}</p>
          <h1 className="text-2xl font-black tracking-tight">{t("translations")}</h1>
        </div>
        <button className="inline-flex items-center gap-2 rounded-full bg-gold px-4 py-2 text-sm font-semibold text-gold-foreground">
          <Plus className="h-4 w-4" /> {t("addLanguage")}
        </button>
      </div>

      <p className="mt-2 max-w-prose text-sm text-muted-foreground">
        Adding a language is a single registry entry plus one locale file. Lessons, quizzes
        and AI responses inherit the new language automatically — fields not yet translated
        fall back to English.
      </p>

      <ul className="mt-6 grid gap-3">
        {LANGUAGES.map((l) => {
          const isBeta = l.coverage < 60;
          return (
            <li
              key={l.code}
              className="rounded-2xl border border-border/70 bg-card/50 p-4"
            >
              <div className="flex items-center gap-4">
                <span className="grid h-12 w-12 place-items-center rounded-xl bg-background/60 text-2xl">
                  {l.flag}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-base font-bold">{l.nativeName}</span>
                    <span className="text-xs text-muted-foreground">· {l.name}</span>
                    {isBeta && (
                      <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-semibold uppercase text-amber-300">
                        {t("beta")}
                      </span>
                    )}
                    {!l.enabled && (
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase text-muted-foreground">
                        Disabled
                      </span>
                    )}
                  </div>
                  <div className="mt-1 text-[11px] text-muted-foreground">
                    {l.dir.toUpperCase()} · code <code className="font-mono">{l.code}</code> · voice <code className="font-mono">{l.voiceLocale}</code>
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-background/60">
                      <div
                        className={`h-full ${l.coverage >= 90 ? "bg-success" : l.coverage >= 60 ? "bg-gold" : "bg-amber-500"}`}
                        style={{ width: `${l.coverage}%` }}
                      />
                    </div>
                    <span className="w-10 shrink-0 text-end text-xs font-semibold text-muted-foreground">
                      {l.coverage}%
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-3 gap-2">
                <button className="flex items-center justify-center gap-1.5 rounded-xl border border-border bg-background/50 px-2 py-2 text-xs font-medium hover:border-gold/40">
                  <FileText className="h-3.5 w-3.5" /> Strings
                </button>
                <button className="flex items-center justify-center gap-1.5 rounded-xl border border-border bg-background/50 px-2 py-2 text-xs font-medium hover:border-gold/40">
                  <Upload className="h-3.5 w-3.5" /> Lessons
                </button>
                <button className="flex items-center justify-center gap-1.5 rounded-xl border border-border bg-background/50 px-2 py-2 text-xs font-medium hover:border-gold/40">
                  <Mic2 className="h-3.5 w-3.5" /> Voice
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      <section className="mt-8 rounded-2xl border border-dashed border-gold/30 bg-gold/5 p-5 text-sm text-muted-foreground">
        <h2 className="text-sm font-semibold text-gold">How adding a language works</h2>
        <ol className="mt-2 list-decimal space-y-1 ps-5">
          <li>Add an entry to <code>src/lib/languages.ts</code>.</li>
          <li>Create <code>src/lib/locales/&lt;code&gt;.ts</code>.</li>
          <li>Register the dictionary in <code>src/lib/i18n.tsx</code>.</li>
          <li>Lessons & quizzes pick it up automatically via <code>localized()</code>.</li>
        </ol>
      </section>
    </AppShell>
  );
}
