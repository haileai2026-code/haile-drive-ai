import { createFileRoute } from "@tanstack/react-router";
import { AdminShell } from "@/components/AdminShell";
import { lessons } from "@/lib/mock-data";
import { useI18n, localized } from "@/lib/i18n";
import { Upload, Video, FileText, Music, Plus } from "lucide-react";

export const Route = createFileRoute("/admin/lessons")({
  head: () => ({ meta: [{ title: "Lessons — Haile Drive AI" }] }),
  component: LessonsAdmin,
});

function LessonsAdmin() {
  const { lang } = useI18n();
  return (
    <AdminShell title="Lesson Management">
      <div className="flex flex-wrap items-center gap-2">
        <button className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-gold px-4 text-sm font-semibold text-gold-foreground"><Plus className="h-4 w-4" /> New lesson</button>
        <button className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-border/60 bg-background/40 px-4 text-sm"><Upload className="h-4 w-4" /> Bulk upload</button>
      </div>

      <div className="mt-4 overflow-hidden rounded-2xl border border-border/60 bg-card/40">
        <table className="w-full text-sm">
          <thead className="bg-background/40 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-3 py-2">Lesson</th>
              <th className="px-3 py-2">Category</th>
              <th className="px-3 py-2">Duration</th>
              <th className="px-3 py-2">Assets</th>
              <th className="px-3 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {lessons.map((l) => (
              <tr key={l.id} className="hover:bg-accent/30">
                <td className="px-3 py-3 font-semibold">{localized(l.title, lang)}</td>
                <td className="px-3 py-3 text-muted-foreground capitalize">{l.category.replace("-", " ")}</td>
                <td className="px-3 py-3 text-muted-foreground">{l.duration} min</td>
                <td className="px-3 py-3">
                  <div className="flex gap-1.5 text-muted-foreground">
                    <span className="inline-flex items-center gap-1 rounded-full border border-border/60 px-2 py-0.5 text-[10px]"><Video className="h-2.5 w-2.5" />Video</span>
                    <span className="inline-flex items-center gap-1 rounded-full border border-border/60 px-2 py-0.5 text-[10px]"><Music className="h-2.5 w-2.5" />AM</span>
                    <span className="inline-flex items-center gap-1 rounded-full border border-border/60 px-2 py-0.5 text-[10px]"><FileText className="h-2.5 w-2.5" />PDF</span>
                  </div>
                </td>
                <td className="px-3 py-3 text-right">
                  <button className="rounded-lg border border-border/60 bg-background/40 px-3 py-1.5 text-xs">Edit</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AdminShell>
  );
}
