import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Bot, GraduationCap, Languages, ShieldCheck, Sparkles } from "lucide-react";
import heroImg from "@/assets/hero-driver.jpg";
import { useI18n } from "@/lib/i18n";
import { LangSwitcher } from "@/components/LangSwitcher";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Haile Drive AI — Learn professional driving in your language" },
      {
        name: "description",
        content:
          "AI-powered learning platform for bus and heavy-vehicle driving students. Lessons, quizzes and an AI teacher in Amharic, Hebrew and English.",
      },
      { property: "og:title", content: "Haile Drive AI" },
      { property: "og:description", content: "Learn professional driving with AI in your own language." },
    ],
  }),
  component: Landing,
});

function Landing() {
  const { t, dir } = useI18n();
  return (
    <div className="min-h-screen bg-night text-foreground" dir={dir}>
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
        <div className="flex items-center gap-2">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-gold to-amber-600 text-gold-foreground text-lg font-black shadow-[var(--shadow-gold)]">H</span>
          <span className="text-sm font-semibold tracking-tight sm:text-base">{t("appName")}</span>
        </div>
        <div className="flex items-center gap-3">
          <LangSwitcher />
          <Link
            to="/login"
            className="hidden rounded-full border border-border bg-card/60 px-4 py-2 text-sm font-medium text-foreground hover:bg-card sm:inline-flex"
          >
            {t("login")}
          </Link>
        </div>
      </header>

      <section className="relative mx-auto grid max-w-6xl gap-10 px-5 pb-16 pt-6 md:grid-cols-2 md:items-center md:pt-12">
        <div className="space-y-6">
          <span className="inline-flex items-center gap-2 rounded-full border border-gold/30 bg-gold/10 px-3 py-1 text-xs font-medium text-gold">
            <Sparkles className="h-3.5 w-3.5" />
            አማርኛ · עברית · English
          </span>
          <h1 className="text-balance text-4xl font-black leading-[1.05] sm:text-5xl md:text-6xl">
            <span className="text-gradient-gold">{t("tagline")}</span>
          </h1>
          <p className="max-w-xl text-pretty text-base text-muted-foreground sm:text-lg">{t("heroSub")}</p>

          <div className="flex flex-wrap gap-3 pt-2">
            <Link
              to="/login"
              className="inline-flex items-center gap-2 rounded-full bg-gradient-to-br from-gold to-amber-600 px-6 py-3 text-base font-semibold text-gold-foreground shadow-[var(--shadow-gold)] transition hover:scale-[1.02]"
            >
              {t("getStarted")} <ArrowRight className="h-4 w-4 rtl:rotate-180" />
            </Link>
            <Link
              to="/dashboard"
              className="inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-6 py-3 text-base font-medium hover:bg-card"
            >
              {t("dashboard")}
            </Link>
          </div>

          <dl className="grid grid-cols-3 gap-4 pt-6 text-center">
            {[
              { n: "120+", l: t("lessons") },
              { n: "AI", l: t("aiTeacher") },
              { n: "RTL", l: "Amharic / עברית" },
            ].map((s) => (
              <div key={s.l} className="rounded-2xl border border-border/60 bg-card/40 p-3">
                <dt className="text-xl font-black text-gold">{s.n}</dt>
                <dd className="mt-1 text-[11px] uppercase tracking-wide text-muted-foreground">{s.l}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="relative">
          <div className="absolute -inset-6 rounded-[2rem] bg-gradient-to-br from-gold/30 via-transparent to-transparent blur-3xl" aria-hidden />
          <div className="relative overflow-hidden rounded-[2rem] border border-gold/20 shadow-[var(--shadow-elev)]">
            <img
              src={heroImg}
              alt="Driver behind the wheel of a heavy vehicle at sunset"
              width={1536}
              height={1024}
              className="h-full w-full object-cover"
            />
            <div className="absolute inset-x-4 bottom-4 rounded-2xl border border-white/10 bg-black/60 p-4 backdrop-blur">
              <div className="flex items-center gap-3">
                <span className="grid h-9 w-9 place-items-center rounded-full bg-gold text-gold-foreground">
                  <Bot className="h-5 w-5" />
                </span>
                <div className="text-sm leading-tight">
                  <div className="font-semibold">{t("aiTeacher")}</div>
                  <div className="text-xs text-white/70">"እንኳን ደህና መጡ — ዛሬ ስለ አየር ብሬክ እንማራለን።"</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-4 px-5 pb-24 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { icon: GraduationCap, t: "Bus & Heavy Vehicle", d: "Air brakes, pre-trip, passenger safety, road signs." },
          { icon: Bot, icon2: true, t: "AI Teacher", d: "Voice & chat — explains theory in simple Amharic." },
          { icon: Languages, t: "3 Languages", d: "Switch anytime — full RTL for Hebrew & Amharic." },
          { icon: ShieldCheck, t: "Exam Ready", d: "Practice quizzes and full exam simulation." },
        ].map((f) => (
          <div key={f.t} className="group rounded-2xl border border-border/60 bg-card/40 p-5 transition hover:border-gold/40 hover:bg-card/70">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-gold/15 text-gold">
              <f.icon className="h-5 w-5" />
            </span>
            <h3 className="mt-4 text-base font-semibold">{f.t}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{f.d}</p>
          </div>
        ))}
      </section>

      <footer className="border-t border-border/60 py-6 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} Haile Drive AI · ለማህበረሰባችን በፍቅር
      </footer>
    </div>
  );
}
