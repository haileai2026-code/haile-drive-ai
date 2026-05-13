import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { useI18n } from "@/lib/i18n";
import { adminApi, type Material } from "@/lib/admin-api";
import { FileText, Image as ImageIcon, Link as LinkIcon, PlayCircle } from "lucide-react";

export const Route = createFileRoute("/lessons")({
  head: () => ({ meta: [{ title: "Lessons — Haile Drive AI" }] }),
  component: LessonsPage,
});

const ICONS = { pdf: FileText, image: ImageIcon, link: LinkIcon, video: PlayCircle } as const;

function LessonsPage() {
  const { t } = useI18n();
  const matsQ = useQuery({ queryKey: ["materials"], queryFn: () => adminApi.listMaterials() });

  const study = (matsQ.data ?? []).filter((m) => m.category === "study");
  const enrichment = (matsQ.data ?? []).filter((m) => m.category === "enrichment");

  return (
    <AppShell>
      <h1 className="text-2xl font-black tracking-tight">{t("lessons")}</h1>
      <p className="mt-1 text-sm text-muted-foreground">חומרי לימוד והעשרה שהוקצו לך</p>

      {matsQ.isLoading && <div className="mt-8 text-sm text-muted-foreground">טוען…</div>}
      {!matsQ.isLoading && (matsQ.data?.length ?? 0) === 0 && (
        <div className="mt-8 rounded-2xl border border-border/60 bg-card/40 p-6 text-center text-sm text-muted-foreground">
          טרם הוקצו חומרי לימוד.
        </div>
      )}

      {study.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-3 text-sm font-bold text-gold">חומרי לימוד</h2>
          <MaterialGrid items={study} />
        </section>
      )}
      {enrichment.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-3 text-sm font-bold text-gold">חומרי העשרה</h2>
          <MaterialGrid items={enrichment} />
        </section>
      )}
    </AppShell>
  );
}

function MaterialGrid({ items }: { items: Material[] }) {
  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {items.map((m) => {
        const Icon = ICONS[m.type];
        const url = m.file_url ?? m.external_link ?? "#";
        return (
          <li key={m.id}>
            <a href={url} target="_blank" rel="noreferrer" className="group block rounded-2xl border border-border/70 bg-card/50 p-4 transition hover:border-gold/40">
              <div className="flex items-start gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-gold/15 text-gold"><Icon className="h-5 w-5" /></div>
                <div className="min-w-0">
                  <div className="text-sm font-semibold">{m.title}</div>
                  {m.description && <div className="mt-1 text-xs text-muted-foreground">{m.description}</div>}
                </div>
              </div>
            </a>
          </li>
        );
      })}
    </ul>
  );
}
