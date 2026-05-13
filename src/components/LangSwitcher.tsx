import { useI18n, type Lang } from "@/lib/i18n";
import { Globe } from "lucide-react";

const labels: Record<Lang, string> = { am: "አማ", he: "עב", en: "EN" };

export function LangSwitcher() {
  const { lang, setLang } = useI18n();
  const order: Lang[] = ["am", "he", "en"];
  return (
    <div className="inline-flex items-center gap-1 rounded-full border border-border bg-card/60 p-1 backdrop-blur">
      <Globe className="ms-2 h-4 w-4 text-muted-foreground" />
      {order.map((l) => (
        <button
          key={l}
          onClick={() => setLang(l)}
          className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
            lang === l ? "bg-gold text-gold-foreground" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {labels[l]}
        </button>
      ))}
    </div>
  );
}
