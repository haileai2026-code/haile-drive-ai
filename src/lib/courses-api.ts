import { supabase } from "@/integrations/supabase/client";

// Typed helpers for the online-courses tables.
// Cast through `any` — generated Database types regenerate after migration apply.
const sb = supabase as any;

export type CourseStatus = "draft" | "published" | "archived";
export type CourseContentType = "video" | "text" | "material" | "quiz" | "live_link";
export type EnrollmentStatus = "active" | "completed" | "cancelled";
export type ProgressStatus = "not_started" | "in_progress" | "completed";

export type OnlineCourse = {
  id: string;
  title_he: string;
  title_am: string | null;
  description_he: string | null;
  description_am: string | null;
  cover_image_url: string | null;
  status: CourseStatus;
  price_ils: number;
  estimated_hours: number | null;
  language: string;
  sort_order: number;
  created_at: string;
};

export type CourseModule = {
  id: string;
  course_id: string;
  title_he: string;
  title_am: string | null;
  sort_order: number;
  estimated_minutes: number | null;
};

export type CourseLesson = {
  id: string;
  module_id: string;
  title_he: string;
  title_am: string | null;
  sort_order: number;
  content_type: CourseContentType;
  content_body: string | null;
  material_id: string | null;
  video_url: string | null;
  duration_minutes: number | null;
  is_free_preview: boolean;
};

export type CourseEnrollment = {
  id: string;
  course_id: string;
  student_id: string;
  status: EnrollmentStatus;
  progress_pct: number;
  enrolled_at: string;
  completed_at: string | null;
};

export type LessonProgress = {
  id: string;
  enrollment_id: string;
  lesson_id: string;
  status: ProgressStatus;
  completed_at: string | null;
};

export type CourseOutline = {
  course: OnlineCourse;
  modules: (CourseModule & { lessons: CourseLesson[] })[];
};

const byOrder = (a: { sort_order: number }, b: { sort_order: number }) => a.sort_order - b.sort_order;

export const coursesApi = {
  /* ---------- COURSES ---------- */
  async list(opts?: { includeUnpublished?: boolean }): Promise<OnlineCourse[]> {
    let q = sb.from("online_courses").select("*").order("sort_order").order("created_at", { ascending: false });
    if (!opts?.includeUnpublished) q = q.eq("status", "published");
    const { data, error } = await q;
    if (error) throw error;
    return data ?? [];
  },
  async get(id: string): Promise<OnlineCourse | null> {
    const { data, error } = await sb.from("online_courses").select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    return data;
  },
  async upsertCourse(c: Partial<OnlineCourse> & { title_he: string }): Promise<OnlineCourse> {
    const { data, error } = await sb.from("online_courses").upsert(c).select("*").single();
    if (error) throw error;
    return data as OnlineCourse;
  },
  async deleteCourse(id: string) {
    const { error } = await sb.from("online_courses").delete().eq("id", id);
    if (error) throw error;
  },

  /* ---------- OUTLINE ---------- */
  async outline(courseId: string): Promise<CourseOutline | null> {
    const course = await coursesApi.get(courseId);
    if (!course) return null;
    const { data: mods, error: mErr } = await sb
      .from("course_modules")
      .select("*")
      .eq("course_id", courseId)
      .order("sort_order");
    if (mErr) throw mErr;
    const modules: CourseModule[] = mods ?? [];
    if (!modules.length) return { course, modules: [] };
    const { data: lessons, error: lErr } = await sb
      .from("course_lessons")
      .select("*")
      .in("module_id", modules.map((m) => m.id))
      .order("sort_order");
    if (lErr) throw lErr;
    const all: CourseLesson[] = lessons ?? [];
    return {
      course,
      modules: modules.sort(byOrder).map((m) => ({
        ...m,
        lessons: all.filter((l) => l.module_id === m.id).sort(byOrder),
      })),
    };
  },

  /* ---------- MODULES ---------- */
  async upsertModule(m: Partial<CourseModule> & { course_id: string; title_he: string }) {
    const { error } = await sb.from("course_modules").upsert(m);
    if (error) throw error;
  },
  async deleteModule(id: string) {
    const { error } = await sb.from("course_modules").delete().eq("id", id);
    if (error) throw error;
  },
  async moveModule(id: string, sort_order: number) {
    const { error } = await sb.from("course_modules").update({ sort_order }).eq("id", id);
    if (error) throw error;
  },

  /* ---------- LESSONS ---------- */
  async upsertLesson(l: Partial<CourseLesson> & { module_id: string; title_he: string }) {
    const { error } = await sb.from("course_lessons").upsert(l);
    if (error) throw error;
  },
  async deleteLesson(id: string) {
    const { error } = await sb.from("course_lessons").delete().eq("id", id);
    if (error) throw error;
  },
  async moveLesson(id: string, sort_order: number) {
    const { error } = await sb.from("course_lessons").update({ sort_order }).eq("id", id);
    if (error) throw error;
  },

  /* ---------- ENROLLMENTS ---------- */
  async myEnrollments(studentId: string): Promise<CourseEnrollment[]> {
    const { data, error } = await sb.from("course_enrollments").select("*").eq("student_id", studentId);
    if (error) throw error;
    return data ?? [];
  },
  async myEnrollment(courseId: string, studentId: string): Promise<CourseEnrollment | null> {
    const { data, error } = await sb
      .from("course_enrollments")
      .select("*")
      .eq("course_id", courseId)
      .eq("student_id", studentId)
      .maybeSingle();
    if (error) throw error;
    return data;
  },
  async enroll(courseId: string, studentId: string): Promise<CourseEnrollment> {
    const { data, error } = await sb
      .from("course_enrollments")
      .insert({ course_id: courseId, student_id: studentId })
      .select("*")
      .single();
    if (error) throw error;
    return data as CourseEnrollment;
  },
  async listEnrollments(courseId: string): Promise<CourseEnrollment[]> {
    const { data, error } = await sb
      .from("course_enrollments")
      .select("*")
      .eq("course_id", courseId)
      .order("enrolled_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  },

  /* ---------- PROGRESS ---------- */
  async lessonProgress(enrollmentId: string): Promise<LessonProgress[]> {
    const { data, error } = await sb.from("course_lesson_progress").select("*").eq("enrollment_id", enrollmentId);
    if (error) throw error;
    return data ?? [];
  },
  /** Mark a lesson complete/incomplete and recompute the enrollment progress. */
  async setLessonStatus(opts: {
    enrollmentId: string;
    lessonId: string;
    status: ProgressStatus;
    totalLessons: number;
  }) {
    const { error } = await sb.from("course_lesson_progress").upsert(
      {
        enrollment_id: opts.enrollmentId,
        lesson_id: opts.lessonId,
        status: opts.status,
        completed_at: opts.status === "completed" ? new Date().toISOString() : null,
      },
      { onConflict: "enrollment_id,lesson_id" },
    );
    if (error) throw error;

    const rows = await coursesApi.lessonProgress(opts.enrollmentId);
    const done = rows.filter((r) => r.status === "completed").length;
    const pct = opts.totalLessons > 0 ? Math.round((done / opts.totalLessons) * 100) : 0;
    const completed = pct >= 100;
    const { error: eErr } = await sb
      .from("course_enrollments")
      .update({
        progress_pct: pct,
        status: completed ? "completed" : "active",
        completed_at: completed ? new Date().toISOString() : null,
      })
      .eq("id", opts.enrollmentId);
    if (eErr) throw eErr;
    return pct;
  },
};

export const LANG_LABEL: Record<string, string> = {
  he: "עברית",
  am: "አማርኛ",
  ru: "Русский",
  multi: "רב־לשוני",
};

export const CONTENT_TYPE_LABEL: Record<CourseContentType, string> = {
  video: "וידאו",
  text: "טקסט",
  material: "חומר לימוד",
  quiz: "בוחן",
  live_link: "שיעור חי",
};

export const STATUS_LABEL: Record<CourseStatus, string> = {
  draft: "טיוטה",
  published: "מפורסם",
  archived: "ארכיון",
};
