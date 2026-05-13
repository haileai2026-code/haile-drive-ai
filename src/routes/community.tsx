import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { useI18n } from "@/lib/i18n";
import { MessageSquare, Megaphone, Trophy } from "lucide-react";

export const Route = createFileRoute("/community")({
  head: () => ({ meta: [{ title: "Community — Haile Drive AI" }] }),
  component: CommunityPage,
});

const posts = [
  { author: "ዳዊት ተስፋዬ", role: "Student", time: "2h", text: "የአየር ብሬክ ፈተናን አለፍኩ! 🎉 ሁሉም አመሰግናለሁ።", icon: Trophy },
  { author: "Teacher Yossi", role: "Teacher", time: "1d", text: "מחר שיעור על תמרורים — אל תפספסו.", icon: Megaphone },
  { author: "ሰናይት ሀይሌ", role: "Student", time: "2d", text: "ማንም የቅድመ ጉዞ ምርመራ ቪዲዮ አለው?", icon: MessageSquare },
];

function CommunityPage() {
  const { t } = useI18n();
  return (
    <AppShell>
      <h1 className="text-2xl font-black tracking-tight">{t("community")}</h1>
      <p className="mt-1 text-sm text-muted-foreground">Q&A · Announcements · Stories</p>

      <ul className="mt-6 space-y-3">
        {posts.map((p, i) => (
          <li key={i} className="rounded-2xl border border-border/70 bg-card/50 p-4">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-full bg-gold/15 text-gold">
                <p.icon className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold">{p.author}</span>
                  <span className="rounded-full border border-border bg-background/60 px-2 py-0.5 text-[10px] text-muted-foreground">{p.role}</span>
                </div>
                <span className="text-[11px] text-muted-foreground">{p.time}</span>
              </div>
            </div>
            <p className="mt-3 text-sm leading-relaxed">{p.text}</p>
          </li>
        ))}
      </ul>
    </AppShell>
  );
}
