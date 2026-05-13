
-- ENUMS
CREATE TYPE public.candidate_status AS ENUM ('new_lead','contacted','missing_docs','waiting_opening','assigned','active','completed','inactive','failed');
CREATE TYPE public.material_category AS ENUM ('study','enrichment');
CREATE TYPE public.material_type AS ENUM ('pdf','image','link','video');

-- CITIES
CREATE TABLE public.cities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  name_he text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.cities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read cities" ON public.cities FOR SELECT TO authenticated USING (true);
CREATE POLICY "Owners insert cities" ON public.cities FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(),'owner'));
CREATE POLICY "Owners update cities" ON public.cities FOR UPDATE TO authenticated USING (has_role(auth.uid(),'owner'));
CREATE POLICY "Owners delete cities" ON public.cities FOR DELETE TO authenticated USING (has_role(auth.uid(),'owner'));
CREATE TRIGGER trg_cities_updated BEFORE UPDATE ON public.cities FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- CLASSES
CREATE TABLE public.classes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  city_id uuid REFERENCES public.cities(id) ON DELETE SET NULL,
  teacher_id uuid,
  schedule text,
  capacity int NOT NULL DEFAULT 20,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read classes" ON public.classes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Owners insert classes" ON public.classes FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(),'owner'));
CREATE POLICY "Owners update classes" ON public.classes FOR UPDATE TO authenticated USING (has_role(auth.uid(),'owner'));
CREATE POLICY "Owners delete classes" ON public.classes FOR DELETE TO authenticated USING (has_role(auth.uid(),'owner'));
CREATE TRIGGER trg_classes_updated BEFORE UPDATE ON public.classes FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- CANDIDATES
CREATE TABLE public.candidates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  phone text,
  email text,
  city_id uuid REFERENCES public.cities(id) ON DELETE SET NULL,
  class_id uuid REFERENCES public.classes(id) ON DELETE SET NULL,
  assigned_teacher_id uuid,
  language text DEFAULT 'he',
  status public.candidate_status NOT NULL DEFAULT 'new_lead',
  notes text,
  tags text[] DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_candidates_teacher ON public.candidates(assigned_teacher_id);
CREATE INDEX idx_candidates_class ON public.candidates(class_id);
ALTER TABLE public.candidates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners view candidates" ON public.candidates FOR SELECT TO authenticated USING (has_role(auth.uid(),'owner') OR has_role(auth.uid(),'staff'));
CREATE POLICY "Teachers view their candidates" ON public.candidates FOR SELECT TO authenticated USING (assigned_teacher_id = auth.uid());
CREATE POLICY "Owners insert candidates" ON public.candidates FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(),'owner'));
CREATE POLICY "Owners update candidates" ON public.candidates FOR UPDATE TO authenticated USING (has_role(auth.uid(),'owner'));
CREATE POLICY "Owners delete candidates" ON public.candidates FOR DELETE TO authenticated USING (has_role(auth.uid(),'owner'));
CREATE TRIGGER trg_candidates_updated BEFORE UPDATE ON public.candidates FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Auto-fill assigned_teacher_id from class when class_id is set
CREATE OR REPLACE FUNCTION public.candidates_sync_teacher()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.class_id IS NOT NULL AND (NEW.assigned_teacher_id IS NULL OR NEW.class_id IS DISTINCT FROM OLD.class_id) THEN
    SELECT teacher_id INTO NEW.assigned_teacher_id FROM public.classes WHERE id = NEW.class_id;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_candidates_sync_teacher BEFORE INSERT OR UPDATE ON public.candidates FOR EACH ROW EXECUTE FUNCTION public.candidates_sync_teacher();

-- TEACHER ASSIGNMENTS
CREATE TABLE public.teacher_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL,
  city_id uuid REFERENCES public.cities(id) ON DELETE CASCADE,
  class_id uuid REFERENCES public.classes(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_ta_teacher ON public.teacher_assignments(teacher_id);
ALTER TABLE public.teacher_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners manage assignments" ON public.teacher_assignments FOR ALL TO authenticated USING (has_role(auth.uid(),'owner')) WITH CHECK (has_role(auth.uid(),'owner'));
CREATE POLICY "Teachers view own assignments" ON public.teacher_assignments FOR SELECT TO authenticated USING (teacher_id = auth.uid());

-- MATERIALS
CREATE TABLE public.materials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  category public.material_category NOT NULL DEFAULT 'study',
  type public.material_type NOT NULL DEFAULT 'pdf',
  file_url text,
  external_link text,
  class_id uuid REFERENCES public.classes(id) ON DELETE SET NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.materials ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read materials" ON public.materials FOR SELECT TO authenticated USING (true);
CREATE POLICY "Owners insert materials" ON public.materials FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(),'owner'));
CREATE POLICY "Owners update materials" ON public.materials FOR UPDATE TO authenticated USING (has_role(auth.uid(),'owner'));
CREATE POLICY "Owners delete materials" ON public.materials FOR DELETE TO authenticated USING (has_role(auth.uid(),'owner'));
CREATE TRIGGER trg_materials_updated BEFORE UPDATE ON public.materials FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- EXAMS
CREATE TABLE public.exams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  class_id uuid REFERENCES public.classes(id) ON DELETE SET NULL,
  created_by uuid,
  is_published boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.exams ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read published or owner all exams" ON public.exams FOR SELECT TO authenticated USING (is_published OR has_role(auth.uid(),'owner') OR has_role(auth.uid(),'staff') OR has_role(auth.uid(),'teacher'));
CREATE POLICY "Owners insert exams" ON public.exams FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(),'owner'));
CREATE POLICY "Owners update exams" ON public.exams FOR UPDATE TO authenticated USING (has_role(auth.uid(),'owner'));
CREATE POLICY "Owners delete exams" ON public.exams FOR DELETE TO authenticated USING (has_role(auth.uid(),'owner'));
CREATE TRIGGER trg_exams_updated BEFORE UPDATE ON public.exams FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- EXAM QUESTIONS
CREATE TABLE public.exam_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id uuid NOT NULL REFERENCES public.exams(id) ON DELETE CASCADE,
  question_text text NOT NULL,
  image_url text,
  order_index int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_eq_exam ON public.exam_questions(exam_id);
ALTER TABLE public.exam_questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read questions" ON public.exam_questions FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.exams e WHERE e.id = exam_id AND (e.is_published OR has_role(auth.uid(),'owner') OR has_role(auth.uid(),'staff') OR has_role(auth.uid(),'teacher')))
);
CREATE POLICY "Owners manage questions" ON public.exam_questions FOR ALL TO authenticated USING (has_role(auth.uid(),'owner')) WITH CHECK (has_role(auth.uid(),'owner'));

-- EXAM OPTIONS
CREATE TABLE public.exam_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id uuid NOT NULL REFERENCES public.exam_questions(id) ON DELETE CASCADE,
  option_text text NOT NULL,
  is_correct boolean NOT NULL DEFAULT false,
  order_index int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_eo_q ON public.exam_options(question_id);
ALTER TABLE public.exam_options ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read options" ON public.exam_options FOR SELECT TO authenticated USING (
  EXISTS (
    SELECT 1 FROM public.exam_questions q JOIN public.exams e ON e.id = q.exam_id
    WHERE q.id = question_id AND (e.is_published OR has_role(auth.uid(),'owner') OR has_role(auth.uid(),'staff') OR has_role(auth.uid(),'teacher'))
  )
);
CREATE POLICY "Owners manage options" ON public.exam_options FOR ALL TO authenticated USING (has_role(auth.uid(),'owner')) WITH CHECK (has_role(auth.uid(),'owner'));

-- STORAGE BUCKET for materials + exam question images
INSERT INTO storage.buckets (id, name, public) VALUES ('materials','materials', true) ON CONFLICT (id) DO NOTHING;
CREATE POLICY "Public read materials bucket" ON storage.objects FOR SELECT USING (bucket_id = 'materials');
CREATE POLICY "Owners upload to materials" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'materials' AND has_role(auth.uid(),'owner'));
CREATE POLICY "Owners update materials objects" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'materials' AND has_role(auth.uid(),'owner'));
CREATE POLICY "Owners delete materials objects" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'materials' AND has_role(auth.uid(),'owner'));

-- Seed some Hebrew cities
INSERT INTO public.cities (name, name_he) VALUES
  ('Ashdod','אשדוד'),
  ('Ramla','רמלה'),
  ('Tel Aviv','תל אביב'),
  ('Jerusalem','ירושלים')
ON CONFLICT DO NOTHING;
