import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/lib/auth";
import { coursesApi, LANG_LABEL } from "@/lib/courses-api";
import { GraduationCap, Clock, Tag } from "lucide-react";

export const Route = createFileRoute("/courses/")({
  head: () => ({
    meta: [
      { title: "קורסים מקוונים — Haile Drive AI" },
      { name: "description", content: "קטלוג הקורסים המקוונים של Haile Drive AI — לימוד עצמי לרישיון אוטובוס ורכב כבד בעברית ובאמהרית." },
      { property: "og:title", content: "קורסים מקוונים — Haile Drive AI" },
      { property: "og:description", content: "קורסים מקוונים בקצב אישי לרישיון אוטובוס ורכב כבד." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CoursesCatalog,
});

function CoursesCatalog() {
  const { user, role } = useAuth();
  const isStaff = role === "owner" || role === "staff";

  const coursesQ = useQuery({
    queryKey: ["online-courses", isStaff],
    queryFn: () => coursesApi.list({ includeUnpublished: isStaff }),
  });
  const enrollQ = useQuery({
    queryKey: ["my-enrollments", user?.id],
    queryFn: () => coursesApi.myEnrollments(user!.id),
    enabled: !!user?.id,
  });

  const progressOf = (courseId: string) =>
    (enrollQ.data ?? []).find((e) => e.course_id === courseId)?.progress_pct ?? null;

  return (
    <AppShell>
      <h1 className="text-2xl font-black tracking-tight">קורסים מקוונים</h1>
      <p className="mt-1 text-sm text-muted-foreground">למידה בקצב אישי — צפו, קראו והתקדמו מתי שנוח לכם</p>

      {coursesQ.isLoading && <div className="mt-6 text-sm text-muted-foreground">טוען קורסים…</div>}

      {!coursesQ.isLoading && (coursesQ.data?.length ?? 0) === 0 && (
        <div className="mt-6 rounded-2xl border border-dashed border-border/60 bg-card/40 p-8 text-center text-sm text-muted-foreground">
          <GraduationCap className="mx-auto h-8 w-8" />
          <p className="mt-2">אין עדיין קורסים מקוונים פתוחים. חזרו בקרוב.</p>
        </div>
      )}

      <ul className="mt-6 grid gap-3 sm:grid-cols-2">
        {(coursesQ.data ?? []).map((c) => {
          const pct = progressOf(c.id);
          return (
            <li key={c.id}>
              <Link
                to="/courses/$courseId"
                params={{ courseId: c.id }}
                className="group block h-full overflow-hidden rounded-2xl border border-border/70 bg-card/50 transition hover:border-gold/40"
              >
                {c.cover_image_url ? (
                  <img src={c.cover_image_url} alt={c.title_he} loading="lazy" className="h-32 w-full object-cover" />
                ) : (
                  <div className="grid h-20 w-full place-items-center bg-gradient-to-br from-gold/20 to-transparent text-gold">
                    <GraduationCap className="h-7 w-7" />
                  </div>
                )}
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-bold">{c.title_he}</div>
                      {c.title_am && <div lang="am" className="truncate text-xs text-muted-foreground">{c.title_am}</div>}
                    </div>
                    {c.status !== "published" && (
                      <span className="shrink-0 rounded-full border border-amber-500/40 px-2 py-0.5 text-[10px] text-amber-300">
                        {c.status === "draft" ? "טיוטה" : "ארכיון"}
                      </span>
                    )}
                  </div>

                  {c.description_he && (
                    <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{c.description_he}</p>
                  )}

                  <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                    {c.estimated_hours != null && (
                      <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" />{c.estimated_hours} שעות</span>
                    )}
                    <span className="inline-flex items-center gap-1">
                      <Tag className="h-3 w-3" />
                      {Number(c.price_ils) > 0 ? `${Number(c.price_ils).toLocaleString("he-IL")} ₪` : "ללא עלות"}
                    </span>
                    <span className="rounded-full border border-border/60 px-2 py-0.5">{LANG_LABEL[c.language] ?? c.language}</span>
                  </div>

                  {pct != null && (
                    <div className="mt-3">
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-background">
                        <div className="h-full rounded-full bg-gold" style={{ width: `${pct}%` }} />
                      </div>
                      <div className="mt-1 text-[11px] text-gold">{pct}% הושלמו</div>
                    </div>
                  )}
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </AppShell>
  );
}
