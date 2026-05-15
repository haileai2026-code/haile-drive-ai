CREATE OR REPLACE FUNCTION public.current_user_matches_candidate(_candidate_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.candidates c
    JOIN public.profiles p ON p.id = auth.uid()
    WHERE c.id = _candidate_id
      AND c.email IS NOT NULL
      AND p.email IS NOT NULL
      AND lower(c.email) = lower(p.email)
  )
$$;

CREATE OR REPLACE FUNCTION public.current_user_in_class(_class_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.candidates c
    JOIN public.profiles p ON p.id = auth.uid()
    WHERE c.class_id = _class_id
      AND c.email IS NOT NULL
      AND p.email IS NOT NULL
      AND lower(c.email) = lower(p.email)
  )
$$;

DROP POLICY IF EXISTS "Students view own candidate" ON public.candidates;
CREATE POLICY "Students view own candidate"
ON public.candidates
FOR SELECT
TO authenticated
USING (public.current_user_matches_candidate(id));

DROP POLICY IF EXISTS "Students view own schedule" ON public.schedule_events;
CREATE POLICY "Students view own schedule"
ON public.schedule_events
FOR SELECT
TO authenticated
USING (
  candidate_id = auth.uid()
  OR (candidate_id IS NOT NULL AND public.current_user_matches_candidate(candidate_id))
  OR (class_id IS NOT NULL AND public.current_user_in_class(class_id))
);

DROP POLICY IF EXISTS "Students view own attendance" ON public.attendance_records;
CREATE POLICY "Students view own attendance"
ON public.attendance_records
FOR SELECT
TO authenticated
USING (
  candidate_id = auth.uid()
  OR public.current_user_matches_candidate(candidate_id)
);

DROP POLICY IF EXISTS "Students view own makeup" ON public.makeup_assignments;
CREATE POLICY "Students view own makeup"
ON public.makeup_assignments
FOR SELECT
TO authenticated
USING (
  candidate_id = auth.uid()
  OR public.current_user_matches_candidate(candidate_id)
);

DROP POLICY IF EXISTS "Students view own notifications" ON public.notifications;
CREATE POLICY "Students view own notifications"
ON public.notifications
FOR SELECT
TO authenticated
USING (
  candidate_id = auth.uid()
  OR (candidate_id IS NOT NULL AND public.current_user_matches_candidate(candidate_id))
);

UPDATE public.candidates
SET email = lower(email)
WHERE email IS NOT NULL AND email <> lower(email);

UPDATE public.profiles
SET email = lower(email)
WHERE email IS NOT NULL AND email <> lower(email);