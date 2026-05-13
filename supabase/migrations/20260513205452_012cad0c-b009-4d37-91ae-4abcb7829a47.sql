
DO $$ BEGIN
  CREATE TYPE public.attendance_mark AS ENUM ('present','late','missing','makeup_completed');
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS public.attendance_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid NOT NULL,
  candidate_id uuid NOT NULL,
  lesson_date date NOT NULL DEFAULT (now() AT TIME ZONE 'utc')::date,
  mark public.attendance_mark NOT NULL,
  notes text,
  marked_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (class_id, candidate_id, lesson_date)
);

CREATE INDEX IF NOT EXISTS idx_attendance_class_date ON public.attendance_records(class_id, lesson_date);
CREATE INDEX IF NOT EXISTS idx_attendance_candidate ON public.attendance_records(candidate_id);

ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER trg_attendance_updated_at BEFORE UPDATE ON public.attendance_records
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Owners & staff: full read
CREATE POLICY "Owners staff view attendance" ON public.attendance_records
FOR SELECT TO authenticated
USING (public.has_role(auth.uid(),'owner') OR public.has_role(auth.uid(),'staff'));

-- Owners: full write
CREATE POLICY "Owners insert attendance" ON public.attendance_records
FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(),'owner'));

CREATE POLICY "Owners update attendance" ON public.attendance_records
FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(),'owner'));

CREATE POLICY "Owners delete attendance" ON public.attendance_records
FOR DELETE TO authenticated
USING (public.has_role(auth.uid(),'owner'));

-- Teachers: view & manage attendance of their classes
CREATE POLICY "Teachers view their class attendance" ON public.attendance_records
FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.classes c WHERE c.id = attendance_records.class_id AND c.teacher_id = auth.uid()));

CREATE POLICY "Teachers insert their class attendance" ON public.attendance_records
FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM public.classes c WHERE c.id = attendance_records.class_id AND c.teacher_id = auth.uid()));

CREATE POLICY "Teachers update their class attendance" ON public.attendance_records
FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM public.classes c WHERE c.id = attendance_records.class_id AND c.teacher_id = auth.uid()));

-- Students: view their own attendance
CREATE POLICY "Students view own attendance" ON public.attendance_records
FOR SELECT TO authenticated
USING (candidate_id = auth.uid() OR EXISTS (SELECT 1 FROM public.candidates c WHERE c.id = attendance_records.candidate_id AND c.email = (SELECT email FROM public.profiles WHERE id = auth.uid())));
