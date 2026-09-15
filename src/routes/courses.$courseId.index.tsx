import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/lib/auth";
import { coursesApi, CONTENT_TYPE_LABEL, LANG_LABEL } from "@/lib/courses-api";
import { BookOpen, Clock, Lock, PlayCircle, Tag, Unlock } from "lucide-react";

export const Route = createFileRoute("/courses/$courseId/")({
  head: () => ({
    meta: [
      { title: "קורס מקוון — Haile Drive AI" },
      { name: "description", content: "פרטי הקורס המקוון: מודולים, שיעורים והרשמה ללמידה עצמית ב-Haile Drive AI." },
      { property: "og:title", content: "קורס מקוון — Haile Drive AI" },
      { property: "og:description", content: "מודולים, שיעורים והרשמה ללמידה עצמית." },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CourseDetail,
});

function CourseDetail() {
  const { courseId } = Route.useParams();
  const { user, role } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const outlineQ = useQuery({ queryKey: ["course-outline", courseId], queryFn: () => coursesApi.outline(courseId) });
  const enrollQ = useQuery({
    queryKey: ["course-enrollment", courseId, user?.id],
    queryFn: () => coursesApi.myEnrollment(courseId, user!.id),
    enabled: !!user?.id,
  });

  const enrollM = useMutation({
    mutationFn: () => coursesApi.enroll(courseId, user!.id),
    onSuccess: () => {
      toast.success("נרשמת לקורס בהצלחה");
      qc.invalidateQueries({ queryKey: ["course-enrollment", courseId] });
      qc.invalidateQueries({ queryKey: ["my-enrollments"] });
      navigate({ to: "/courses/$courseId/learn", params: { courseId } });
    },
    onError: () => toast.error("ההרשמה נכשלה — יש להסדיר תשלום או לפנות למשרד"),
  });

  const course = outlineQ.data?.course;
  const modules = outlineQ.data?.modules ?? [];
  const enrollment = enrollQ.data ?? null;
  const isLead = role === "lead";
  const canEnroll = !isLead && !enrollment;

  if (outlineQ.isLoading) {
    return <AppShell><div className="text-sm text-muted-foreground">טוען קורס…</div></AppShell>;
  }
  if (!course) {
    return (
      <AppShell>
        <div className="rounded-2xl border border-dashed border-border/60 p-8 text-center text-sm text-muted-foreground">
          הקורס לא נמצא.
          <div className="mt-3"><Link to="/courses" className="text-gold underline">חזרה לקטלוג</Link></div>
        </div>
      </AppShell>
    );
  }

  const totalLessons = modules.reduce((n, m) => n + m.lessons.length, 0);

  return (
    <AppShell>
      <Link to="/courses" className="text-xs text-muted-foreground underline">← כל הקורסים</Link>

      <header className="mt-3 overflow-hidden rounded-2xl border border-gold/30 bg-gradient-to-b from-gold/10 to-card/40">
        {course.cover_image_url && (
          <img src={course.cover_image_url} alt={course.title_he} className="h-40 w-full object-cover" />
        )}
        <div className="p-5">
          <h1 className="text-2xl font-black tracking-tight">{course.title_he}</h1>
          {course.title_am && <div lang="am" className="mt-1 text-sm text-muted-foreground">{course.title_am}</div>}
          {course.description_he && <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{course.description_he}</p>}
          {course.description_am && <p lang="am" className="mt-2 text-sm leading-relaxed text-muted-foreground">{course.description_am}</p>}

          <div className="mt-4 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1"><BookOpen className="h-3 w-3" />{totalLessons} שיעורים</span>
            {course.estimated_hours != null && (
              <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" />{course.estimated_hours} שעות</span>
            )}
            <span className="inline-flex items-center gap-1">
              <Tag className="h-3 w-3" />
              {Number(course.price_ils) > 0 ? `${Number(course.price_ils).toLocaleString("he-IL")} ₪` : "ללא עלות"}
            </span>
            <span className="rounded-full border border-border/60 px-2 py-0.5">{LANG_LABEL[course.language] ?? course.language}</span>
          </div>

          <div className="mt-5">
            {enrollment ? (
              <div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-background">
                  <div className="h-full rounded-full bg-gold" style={{ width: `${enrollment.progress_pct}%` }} />
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-xs text-gold">{enrollment.progress_pct}% הושלמו</span>
                  <Link
                    to="/courses/$courseId/learn"
                    params={{ courseId }}
                    className="inline-flex min-h-11 items-center rounded-xl bg-gold px-5 text-sm font-bold text-gold-foreground"
                  >
                    המשך למידה
                  </Link>
                </div>
              </div>
            ) : isLead ? (
              <div className="rounded-xl border border-border/60 bg-background/60 p-3 text-xs text-muted-foreground">
                הרשמה לקורס נפתחת לאחר הסדרת התשלום. עד אז אפשר לצפות בשיעורי ההדגמה החופשיים שלמטה.
              </div>
            ) : canEnroll ? (
              <button
                onClick={() => enrollM.mutate()}
                disabled={enrollM.isPending}
                className="min-h-11 rounded-xl bg-gold px-6 text-sm font-bold text-gold-foreground disabled:opacity-60"
              >
                {enrollM.isPending ? "נרשם…" : "הרשמה לקורס"}
              </button>
            ) : null}
          </div>
        </div>
      </header>

      <section className="mt-6">
        <h2 className="mb-3 text-sm font-bold text-gold">תוכנית הקורס</h2>
        {modules.length === 0 && (
          <div className="rounded-2xl border border-dashed border-border/60 p-6 text-center text-sm text-muted-foreground">
            תוכן הקורס בהכנה.
          </div>
        )}
        <ol className="space-y-3">
          {modules.map((m, mi) => (
            <li key={m.id} className="rounded-2xl border border-border/60 bg-card/40 p-4">
              <div className="flex items-baseline justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-sm font-bold">{mi + 1}. {m.title_he}</div>
                  {m.title_am && <div lang="am" className="text-xs text-muted-foreground">{m.title_am}</div>}
                </div>
                {m.estimated_minutes != null && (
                  <span className="shrink-0 text-[11px] text-muted-foreground">{m.estimated_minutes} דק׳</span>
                )}
              </div>
              <ul className="mt-3 space-y-1.5">
                {m.lessons.length === 0 && <li className="text-xs text-muted-foreground">אין שיעורים במודול זה עדיין.</li>}
                {m.lessons.map((l) => {
                  const unlocked = !!enrollment || l.is_free_preview;
                  return (
                    <li key={l.id} className="flex items-center gap-2 rounded-xl border border-border/50 bg-background/40 px-3 py-2">
                      {unlocked ? <PlayCircle className="h-4 w-4 shrink-0 text-gold" /> : <Lock className="h-4 w-4 shrink-0 text-muted-foreground" />}
                      <span className="min-w-0 flex-1 truncate text-sm">{l.title_he}</span>
                      {l.is_free_preview && !enrollment && (
                        <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-emerald-500/30 px-2 py-0.5 text-[10px] text-emerald-300">
                          <Unlock className="h-3 w-3" /> צפייה חופשית
                        </span>
                      )}
                      <span className="shrink-0 text-[10px] text-muted-foreground">{CONTENT_TYPE_LABEL[l.content_type]}</span>
                    </li>
                  );
                })}
              </ul>
            </li>
          ))}
        </ol>
      </section>
    </AppShell>
  );
}
