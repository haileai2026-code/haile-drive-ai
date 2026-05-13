
-- 1. Status enum
DO $$ BEGIN
  CREATE TYPE public.makeup_status AS ENUM ('pending', 'scheduled', 'completed', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. Table
CREATE TABLE IF NOT EXISTS public.makeup_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id uuid NOT NULL,
  source_attendance_id uuid,
  source_class_id uuid NOT NULL,
  source_date date NOT NULL,
  target_class_id uuid,
  target_date date,
  status public.makeup_status NOT NULL DEFAULT 'pending',
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (candidate_id, source_class_id, source_date)
);

CREATE INDEX IF NOT EXISTS idx_makeup_status ON public.makeup_assignments(status);
CREATE INDEX IF NOT EXISTS idx_makeup_candidate ON public.makeup_assignments(candidate_id);
CREATE INDEX IF NOT EXISTS idx_makeup_target_class ON public.makeup_assignments(target_class_id);
CREATE INDEX IF NOT EXISTS idx_makeup_source_class ON public.makeup_assignments(source_class_id);

-- 3. Updated_at trigger
DROP TRIGGER IF EXISTS trg_makeup_updated_at ON public.makeup_assignments;
CREATE TRIGGER trg_makeup_updated_at
  BEFORE UPDATE ON public.makeup_assignments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 4. Auto-create / sync makeup rows from attendance
CREATE OR REPLACE FUNCTION public.attendance_sync_makeup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.mark = 'missing' THEN
    INSERT INTO public.makeup_assignments
      (candidate_id, source_attendance_id, source_class_id, source_date, status)
    VALUES
      (NEW.candidate_id, NEW.id, NEW.class_id, NEW.lesson_date, 'pending')
    ON CONFLICT (candidate_id, source_class_id, source_date) DO NOTHING;
  ELSIF NEW.mark = 'makeup_completed' THEN
    UPDATE public.makeup_assignments
       SET status = 'completed', updated_at = now()
     WHERE candidate_id = NEW.candidate_id
       AND source_class_id = NEW.class_id
       AND source_date = NEW.lesson_date
       AND status <> 'completed';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_attendance_sync_makeup ON public.attendance_records;
CREATE TRIGGER trg_attendance_sync_makeup
  AFTER INSERT OR UPDATE OF mark ON public.attendance_records
  FOR EACH ROW EXECUTE FUNCTION public.attendance_sync_makeup();

-- 5. RLS
ALTER TABLE public.makeup_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owners staff view makeup" ON public.makeup_assignments;
CREATE POLICY "Owners staff view makeup" ON public.makeup_assignments
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'staff'));

DROP POLICY IF EXISTS "Owners insert makeup" ON public.makeup_assignments;
CREATE POLICY "Owners insert makeup" ON public.makeup_assignments
  FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'staff'));

DROP POLICY IF EXISTS "Owners update makeup" ON public.makeup_assignments;
CREATE POLICY "Owners update makeup" ON public.makeup_assignments
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'staff'));

DROP POLICY IF EXISTS "Owners delete makeup" ON public.makeup_assignments;
CREATE POLICY "Owners delete makeup" ON public.makeup_assignments
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'owner'));

DROP POLICY IF EXISTS "Teachers view related makeup" ON public.makeup_assignments;
CREATE POLICY "Teachers view related makeup" ON public.makeup_assignments
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.classes c
             WHERE c.teacher_id = auth.uid()
               AND (c.id = makeup_assignments.source_class_id
                 OR c.id = makeup_assignments.target_class_id))
  );

DROP POLICY IF EXISTS "Students view own makeup" ON public.makeup_assignments;
CREATE POLICY "Students view own makeup" ON public.makeup_assignments
  FOR SELECT TO authenticated
  USING (
    candidate_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.candidates c
      WHERE c.id = makeup_assignments.candidate_id
        AND c.email = (SELECT email FROM public.profiles WHERE id = auth.uid())
    )
  );

-- 6. Backfill: create pending rows for any existing 'missing' attendance
INSERT INTO public.makeup_assignments
  (candidate_id, source_attendance_id, source_class_id, source_date, status)
SELECT a.candidate_id, a.id, a.class_id, a.lesson_date, 'pending'
  FROM public.attendance_records a
 WHERE a.mark = 'missing'
ON CONFLICT (candidate_id, source_class_id, source_date) DO NOTHING;
