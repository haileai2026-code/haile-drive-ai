import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/lib/auth";
import { coursesApi, CONTENT_TYPE_LABEL, type CourseLesson } from "@/lib/courses-api";
import { resolveMaterialUrl } from "@/lib/materials";
import { adminApi } from "@/lib/admin-api";
import { CheckCircle2, Circle, ExternalLink, Lock } from "lucide-react";

export const Route = createFileRoute("/courses/$courseId/learn")({
  head: () => ({
    meta: [
      { title: "למידה בקורס — Haile Drive AI" },
      { name: "description", content: "נגן התוכן של הקורס המקוון — שיעורים, חומרים וסימון התקדמות ב-Haile Drive AI." },
      { property: "og:title", content: "למידה בקורס — Haile Drive AI" },
      { property: "og:description", content: "שיעורים, חומרים וסימון התקדמות." },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LearnPage,
});

function LearnPage() {
  const { courseId } = Route.useParams();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [activeId, setActiveId] = useState<string | null>(null);

  const outlineQ = useQuery({ queryKey: ["course-outline", courseId], queryFn: () => coursesApi.outline(courseId) });
  const enrollQ = useQuery({
    queryKey: ["course-enrollment", courseId, user?.id],
    queryFn: () => coursesApi.myEnrollment(courseId, user!.id),
    enabled: !!user?.id,
  });
  const enrollment = enrollQ.data ?? null;
  const progressQ = useQuery({
    queryKey: ["course-lesson-progress", enrollment?.id],
    queryFn: () => coursesApi.lessonProgress(enrollment!.id),
    enabled: !!enrollment?.id,
  });

  const modules = outlineQ.data?.modules ?? [];
  const lessons = useMemo(() => modules.flatMap((m) => m.lessons), [modules]);
  const totalLessons = lessons.length;

  useEffect(() => {
    if (!activeId && lessons.length) setActiveId(lessons[0].id);
  }, [lessons, activeId]);

  const active = lessons.find((l) => l.id === activeId) ?? null;
  const doneIds = new Set((progressQ.data ?? []).filter((p) => p.status === "completed").map((p) => p.lesson_id));

  const toggleM = useMutation({
    mutationFn: (lesson: CourseLesson) =>
      coursesApi.setLessonStatus({
        enrollmentId: enrollment!.id,
        lessonId: lesson.id,
        status: doneIds.has(lesson.id) ? "in_progress" : "completed",
        totalLessons,
      }),
    onSuccess: (pct) => {
      qc.invalidateQueries({ queryKey: ["course-lesson-progress", enrollment?.id] });
      qc.invalidateQueries({ queryKey: ["course-enrollment", courseId] });
      qc.invalidateQueries({ queryKey: ["my-enrollments"] });
      if (pct >= 100) toast.success("כל הכבוד! סיימת את הקורס 🎉");
    },
    onError: () => toast.error("שמירת ההתקדמות נכשלה"),
  });

  if (outlineQ.isLoading || enrollQ.isLoading) {
    return <AppShell><div className="text-sm text-muted-foreground">טוען…</div></AppShell>;
  }

  const unlocked = (l: CourseLesson) => !!enrollment || l.is_free_preview;

  return (
    <AppShell>
      <Link to="/courses/$courseId" params={{ courseId }} className="text-xs text-muted-foreground underline">
        ← חזרה לדף הקורס
      </Link>

      {enrollment && (
        <div className="mt-3 rounded-2xl border border-border/60 bg-card/40 p-3">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-background">
            <div className="h-full rounded-full bg-gold" style={{ width: `${enrollment.progress_pct}%` }} />
          </div>
          <div className="mt-1 text-[11px] text-gold">{enrollment.progress_pct}% הושלמו</div>
        </div>
      )}

      {totalLessons === 0 && (
        <div className="mt-6 rounded-2xl border border-dashed border-border/60 p-8 text-center text-sm text-muted-foreground">
          אין עדיין שיעורים בקורס הזה.
        </div>
      )}

      <div className="mt-4 grid gap-4 lg:grid-cols-[18rem_1fr]">
        <aside className="space-y-3">
          {modules.map((m, mi) => (
            <div key={m.id} className="rounded-2xl border border-border/60 bg-card/40 p-3">
              <div className="text-xs font-bold text-gold">{mi + 1}. {m.title_he}</div>
              <ul className="mt-2 space-y-1">
                {m.lessons.map((l) => {
                  const open = unlocked(l);
                  const isActive = l.id === activeId;
                  return (
                    <li key={l.id}>
                      <button
                        onClick={() => open && setActiveId(l.id)}
                        disabled={!open}
                        className={`flex min-h-11 w-full items-center gap-2 rounded-xl px-2.5 py-2 text-right text-sm transition ${
                          isActive ? "bg-gold/15 text-gold" : "text-muted-foreground hover:bg-accent"
                        } ${open ? "" : "opacity-60"}`}
                      >
                        {!open ? <Lock className="h-4 w-4 shrink-0" />
                          : doneIds.has(l.id) ? <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
                          : <Circle className="h-4 w-4 shrink-0" />}
                        <span className="min-w-0 flex-1 truncate">{l.title_he}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </aside>

        <section className="min-w-0">
          {!active && totalLessons > 0 && (
            <div className="rounded-2xl border border-dashed border-border/60 p-8 text-center text-sm text-muted-foreground">
              בחרו שיעור מהרשימה.
            </div>
          )}
          {active && !unlocked(active) && (
            <div className="rounded-2xl border border-border/60 p-8 text-center text-sm text-muted-foreground">
              שיעור זה נעול. יש להירשם לקורס כדי לצפות.
            </div>
          )}
          {active && unlocked(active) && (
            <article className="rounded-2xl border border-border/60 bg-card/40 p-5">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-lg font-black tracking-tight">{active.title_he}</h1>
                <span className="rounded-full border border-border/60 px-2 py-0.5 text-[10px] text-muted-foreground">
                  {CONTENT_TYPE_LABEL[active.content_type]}
                </span>
                {active.duration_minutes != null && (
                  <span className="text-[11px] text-muted-foreground">{active.duration_minutes} דק׳</span>
                )}
              </div>
              {active.title_am && <div lang="am" className="mt-1 text-sm text-muted-foreground">{active.title_am}</div>}

              <div className="mt-4">
                <LessonBody lesson={active} />
              </div>

              {enrollment && (
                <button
                  onClick={() => toggleM.mutate(active)}
                  disabled={toggleM.isPending}
                  className={`mt-6 min-h-11 rounded-xl px-5 text-sm font-bold disabled:opacity-60 ${
                    doneIds.has(active.id)
                      ? "border border-emerald-500/40 text-emerald-300"
                      : "bg-gold text-gold-foreground"
                  }`}
                >
                  {doneIds.has(active.id) ? "✓ הושלם — בטל סימון" : "סמן כהושלם"}
                </button>
              )}
            </article>
          )}
        </section>
      </div>
    </AppShell>
  );
}

function LessonBody({ lesson }: { lesson: CourseLesson }) {
  const materialQ = useQuery({
    queryKey: ["course-lesson-material", lesson.material_id],
    queryFn: async () => {
      const mats = await adminApi.listMaterials();
      const mat = mats.find((m) => m.id === lesson.material_id);
      if (!mat) return null;
      const url = mat.external_link || (await resolveMaterialUrl(mat.file_url));
      return { title: mat.title, url };
    },
    enabled: lesson.content_type === "material" && !!lesson.material_id,
  });

  if (lesson.content_type === "video" && lesson.video_url) {
    return (
      <div className="overflow-hidden rounded-xl border border-border/60">
        <video src={lesson.video_url} controls playsInline className="w-full" />
      </div>
    );
  }

  if (lesson.content_type === "live_link" && lesson.video_url) {
    return (
      <a href={lesson.video_url} target="_blank" rel="noreferrer"
        className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-gold px-5 text-sm font-bold text-gold-foreground">
        <ExternalLink className="h-4 w-4" /> הצטרפות לשיעור החי
      </a>
    );
  }

  if (lesson.content_type === "material") {
    if (materialQ.isLoading) return <div className="text-sm text-muted-foreground">טוען חומר…</div>;
    const m = materialQ.data;
    if (!m?.url) return <div className="text-sm text-muted-foreground">החומר אינו זמין כרגע.</div>;
    return (
      <a href={m.url} target="_blank" rel="noreferrer"
        className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-gold/40 px-5 text-sm font-bold text-gold">
        <ExternalLink className="h-4 w-4" /> פתיחת «{m.title}»
      </a>
    );
  }

  if (lesson.content_body) {
    return (
      <div className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">{lesson.content_body}</div>
    );
  }

  return <div className="text-sm text-muted-foreground">אין תוכן לשיעור זה עדיין.</div>;
}
