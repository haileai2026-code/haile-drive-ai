CREATE TYPE public.course_status AS ENUM ('draft','published','archived');
CREATE TYPE public.course_content_type AS ENUM ('video','text','material','quiz','live_link');
CREATE TYPE public.course_enrollment_status AS ENUM ('active','completed','cancelled');
CREATE TYPE public.course_progress_status AS ENUM ('not_started','in_progress','completed');

CREATE TABLE public.online_courses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title_he text NOT NULL,
  title_am text,
  description_he text,
  description_am text,
  cover_image_url text,
  status public.course_status NOT NULL DEFAULT 'draft',
  price_ils numeric NOT NULL DEFAULT 0,
  estimated_hours numeric,
  language text NOT NULL DEFAULT 'he',
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.online_courses TO authenticated;
GRANT ALL ON public.online_courses TO service_role;
ALTER TABLE public.online_courses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "courses readable when published" ON public.online_courses FOR SELECT TO authenticated
  USING (status = 'published' OR public.has_role(auth.uid(),'owner') OR public.has_role(auth.uid(),'staff'));
CREATE POLICY "courses managed by staff" ON public.online_courses FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'owner') OR public.has_role(auth.uid(),'staff'))
  WITH CHECK (public.has_role(auth.uid(),'owner') OR public.has_role(auth.uid(),'staff'));
CREATE TRIGGER trg_online_courses_updated BEFORE UPDATE ON public.online_courses
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.course_modules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES public.online_courses(id) ON DELETE CASCADE,
  title_he text NOT NULL,
  title_am text,
  sort_order integer NOT NULL DEFAULT 0,
  estimated_minutes integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.course_modules TO authenticated;
GRANT ALL ON public.course_modules TO service_role;
ALTER TABLE public.course_modules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "modules readable when course visible" ON public.course_modules FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.online_courses c WHERE c.id = course_id
    AND (c.status = 'published' OR public.has_role(auth.uid(),'owner') OR public.has_role(auth.uid(),'staff'))));
CREATE POLICY "modules managed by staff" ON public.course_modules FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'owner') OR public.has_role(auth.uid(),'staff'))
  WITH CHECK (public.has_role(auth.uid(),'owner') OR public.has_role(auth.uid(),'staff'));
CREATE TRIGGER trg_course_modules_updated BEFORE UPDATE ON public.course_modules
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.course_lessons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id uuid NOT NULL REFERENCES public.course_modules(id) ON DELETE CASCADE,
  title_he text NOT NULL,
  title_am text,
  sort_order integer NOT NULL DEFAULT 0,
  content_type public.course_content_type NOT NULL DEFAULT 'text',
  content_body text,
  material_id uuid REFERENCES public.materials(id) ON DELETE SET NULL,
  video_url text,
  duration_minutes integer,
  is_free_preview boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.course_lessons TO authenticated;
GRANT ALL ON public.course_lessons TO service_role;
ALTER TABLE public.course_lessons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "course lessons readable when course visible" ON public.course_lessons FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.course_modules m JOIN public.online_courses c ON c.id = m.course_id
    WHERE m.id = module_id
    AND (c.status = 'published' OR public.has_role(auth.uid(),'owner') OR public.has_role(auth.uid(),'staff'))));
CREATE POLICY "course lessons managed by staff" ON public.course_lessons FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'owner') OR public.has_role(auth.uid(),'staff'))
  WITH CHECK (public.has_role(auth.uid(),'owner') OR public.has_role(auth.uid(),'staff'));
CREATE TRIGGER trg_course_lessons_updated BEFORE UPDATE ON public.course_lessons
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.course_enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES public.online_courses(id) ON DELETE CASCADE,
  student_id uuid NOT NULL,
  status public.course_enrollment_status NOT NULL DEFAULT 'active',
  progress_pct numeric NOT NULL DEFAULT 0,
  enrolled_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (course_id, student_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.course_enrollments TO authenticated;
GRANT ALL ON public.course_enrollments TO service_role;
ALTER TABLE public.course_enrollments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "enrollments own read" ON public.course_enrollments FOR SELECT TO authenticated
  USING (student_id = auth.uid() OR public.has_role(auth.uid(),'owner') OR public.has_role(auth.uid(),'staff'));
CREATE POLICY "enrollments own insert" ON public.course_enrollments FOR INSERT TO authenticated
  WITH CHECK (student_id = auth.uid() AND (public.has_role(auth.uid(),'student') OR public.has_role(auth.uid(),'owner') OR public.has_role(auth.uid(),'staff'))
    AND EXISTS (SELECT 1 FROM public.online_courses c WHERE c.id = course_id AND c.status = 'published'));
CREATE POLICY "enrollments own update" ON public.course_enrollments FOR UPDATE TO authenticated
  USING (student_id = auth.uid() OR public.has_role(auth.uid(),'owner') OR public.has_role(auth.uid(),'staff'))
  WITH CHECK (student_id = auth.uid() OR public.has_role(auth.uid(),'owner') OR public.has_role(auth.uid(),'staff'));
CREATE POLICY "enrollments staff delete" ON public.course_enrollments FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'owner') OR public.has_role(auth.uid(),'staff'));
CREATE TRIGGER trg_course_enrollments_updated BEFORE UPDATE ON public.course_enrollments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.course_lesson_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id uuid NOT NULL REFERENCES public.course_enrollments(id) ON DELETE CASCADE,
  lesson_id uuid NOT NULL REFERENCES public.course_lessons(id) ON DELETE CASCADE,
  status public.course_progress_status NOT NULL DEFAULT 'not_started',
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (enrollment_id, lesson_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.course_lesson_progress TO authenticated;
GRANT ALL ON public.course_lesson_progress TO service_role;
ALTER TABLE public.course_lesson_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lesson progress own all" ON public.course_lesson_progress FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.course_enrollments e WHERE e.id = enrollment_id
      AND (e.student_id = auth.uid() OR public.has_role(auth.uid(),'owner') OR public.has_role(auth.uid(),'staff'))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.course_enrollments e WHERE e.id = enrollment_id
      AND (e.student_id = auth.uid() OR public.has_role(auth.uid(),'owner') OR public.has_role(auth.uid(),'staff'))));
CREATE TRIGGER trg_course_lesson_progress_updated BEFORE UPDATE ON public.course_lesson_progress
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_course_modules_course ON public.course_modules(course_id, sort_order);
CREATE INDEX idx_course_lessons_module ON public.course_lessons(module_id, sort_order);
CREATE INDEX idx_course_enrollments_student ON public.course_enrollments(student_id);
CREATE INDEX idx_course_lesson_progress_enrollment ON public.course_lesson_progress(enrollment_id);