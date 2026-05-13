import { useI18n } from "@/lib/i18n";
import { Link } from "@tanstack/react-router";
import { Globe } from "lucide-react";

export function LangSwitcher({ compact = true }: { compact?: boolean }) {
  const { lang, setLang, languages } = useI18n();

  // If we have many languages, switch to a "globe + current + link to picker" pattern.
  if (languages.length > 4 && compact) {
    const current = languages.find((l) => l.code === lang);
    return (
      <Link
        to="/language"
        className="inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-3 py-1.5 text-xs font-semibold backdrop-blur hover:border-gold/40"
      >
        <Globe className="h-4 w-4 text-gold" />
        <span>{current?.flag}</span>
        <span>{current?.nativeName}</span>
      </Link>
    );
  }

  return (
    <div className="inline-flex items-center gap-1 rounded-full border border-border bg-card/60 p-1 backdrop-blur">
      <Globe className="ms-2 h-4 w-4 text-muted-foreground" />
      {languages.map((l) => (
        <button
          key={l.code}
          onClick={() => setLang(l.code)}
          className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
            lang === l.code ? "bg-gold text-gold-foreground" : "text-muted-foreground hover:text-foreground"
          }`}
          title={l.name}
        >
          {l.flag} {l.nativeName}
        </button>
      ))}
    </div>
  );
}
