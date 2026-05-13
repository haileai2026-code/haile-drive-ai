-- Enum for schedule event types
DO $$ BEGIN
  CREATE TYPE public.schedule_event_type AS ENUM ('lesson', 'exam', 'makeup');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.schedule_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type public.schedule_event_type NOT NULL DEFAULT 'lesson',
  title text NOT NULL,
  class_id uuid REFERENCES public.classes(id) ON DELETE CASCADE,
  exam_id uuid REFERENCES public.exams(id) ON DELETE SET NULL,
  candidate_id uuid REFERENCES public.candidates(id) ON DELETE CASCADE,
  event_date date NOT NULL,
  start_time time,
  end_time time,
  location text,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_schedule_events_class_date ON public.schedule_events(class_id, event_date);
CREATE INDEX IF NOT EXISTS idx_schedule_events_candidate ON public.schedule_events(candidate_id);

ALTER TABLE public.schedule_events ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER schedule_events_set_updated_at
BEFORE UPDATE ON public.schedule_events
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Owners + staff: full read
CREATE POLICY "Owners staff view schedule" ON public.schedule_events
FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'staff'::app_role));

-- Owners: full write
CREATE POLICY "Owners insert schedule" ON public.schedule_events
FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'staff'::app_role));

CREATE POLICY "Owners update schedule" ON public.schedule_events
FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'staff'::app_role));

CREATE POLICY "Owners delete schedule" ON public.schedule_events
FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'owner'::app_role));

-- Teachers: see + manage events for their classes
CREATE POLICY "Teachers view their schedule" ON public.schedule_events
FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM classes c WHERE c.id = schedule_events.class_id AND c.teacher_id = auth.uid()));

CREATE POLICY "Teachers insert their schedule" ON public.schedule_events
FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM classes c WHERE c.id = schedule_events.class_id AND c.teacher_id = auth.uid()));

CREATE POLICY "Teachers update their schedule" ON public.schedule_events
FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM classes c WHERE c.id = schedule_events.class_id AND c.teacher_id = auth.uid()));

-- Students: see events for their class or that target them personally (makeup)
CREATE POLICY "Students view own schedule" ON public.schedule_events
FOR SELECT TO authenticated
USING (
  candidate_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM candidates c
    WHERE c.id = schedule_events.candidate_id
      AND c.email = (SELECT email FROM profiles WHERE id = auth.uid())
  )
  OR EXISTS (
    SELECT 1 FROM candidates c
    WHERE c.class_id = schedule_events.class_id
      AND (c.id = auth.uid() OR c.email = (SELECT email FROM profiles WHERE id = auth.uid()))
  )
);
