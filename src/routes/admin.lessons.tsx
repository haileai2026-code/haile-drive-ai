import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AdminShell } from "@/components/AdminShell";
import { supabase } from "@/integrations/supabase/client";
import { ExternalLink, FileText, Plus } from "lucide-react";

export const Route = createFileRoute("/admin/lessons")({
  head: () => ({ meta: [{ title: "Lessons — Haile Drive AI" }] }),
  component: LessonsAdmin,
});

type Material = {
  id: string;
  title: string;
  category: string;
  type: string;
  external_link: string | null;
  file_url: string | null;
  created_at: string;
};

function LessonsAdmin() {
  const [rows, setRows] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("materials")
        .select("id, title, category, type, external_link, file_url, created_at")
        .order("created_at", { ascending: false });
      if (cancelled) return;
      setRows((data as Material[] | null) ?? []);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <AdminShell title="ניהול שיעורים">
      <div className="flex flex-wrap items-center gap-2">
        <Link
          to="/admin/content"
          className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-gold px-4 text-sm font-semibold text-gold-foreground"
        >
          <Plus className="h-4 w-4" /> נהל חומרי לימוד
        </Link>
      </div>

      {loading ? (
        <div className="mt-4 rounded-2xl border border-border/60 bg-card/40 p-6 text-center text-sm text-muted-foreground">
          טוען…
        </div>
      ) : rows.length === 0 ? (
        <div className="mt-4 rounded-2xl border border-dashed border-border/60 bg-card/40 p-8 text-center text-sm text-muted-foreground">
          <FileText className="mx-auto h-6 w-6 text-muted-foreground" />
          <div className="mt-2">עדיין לא הועלו שיעורים.</div>
          <Link to="/admin/content" className="mt-3 inline-block text-xs text-gold">
            עבור ל"חומרי לימוד" כדי להעלות
          </Link>
        </div>
      ) : (
        <div className="mt-4 overflow-hidden rounded-2xl border border-border/60 bg-card/40">
          <table className="w-full text-sm">
            <thead className="bg-background/40 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-3 py-2">שיעור</th>
                <th className="px-3 py-2">קטגוריה</th>
                <th className="px-3 py-2">סוג</th>
                <th className="px-3 py-2 text-right">קישור</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {rows.map((l) => {
                const href = l.external_link || l.file_url;
                return (
                  <tr key={l.id} className="hover:bg-accent/30">
                    <td className="px-3 py-3 font-semibold">{l.title}</td>
                    <td className="px-3 py-3 text-muted-foreground capitalize">{l.category}</td>
                    <td className="px-3 py-3 text-muted-foreground capitalize">{l.type}</td>
                    <td className="px-3 py-3 text-right">
                      {href ? (
                        <a
                          href={href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 rounded-lg border border-border/60 bg-background/40 px-3 py-1.5 text-xs hover:border-gold/40"
                        >
                          <ExternalLink className="h-3 w-3" /> פתח
                        </a>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </AdminShell>
  );
}
