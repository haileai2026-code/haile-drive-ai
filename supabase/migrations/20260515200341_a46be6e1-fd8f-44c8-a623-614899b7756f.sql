DROP POLICY IF EXISTS "Students view own candidate" ON public.candidates;
CREATE POLICY "Students view own candidate"
ON public.candidates
FOR SELECT
TO authenticated
USING (
  email IS NOT NULL
  AND lower(email) = lower((SELECT p.email FROM public.profiles p WHERE p.id = auth.uid()))
);

DROP POLICY IF EXISTS "Students view own schedule" ON public.schedule_events;
CREATE POLICY "Students view own schedule"
ON public.schedule_events
FOR SELECT
TO authenticated
USING (
  candidate_id = auth.uid()
  OR EXISTS (
    SELECT 1
    FROM public.candidates c
    WHERE c.id = schedule_events.candidate_id
      AND c.email IS NOT NULL
      AND lower(c.email) = lower((SELECT p.email FROM public.profiles p WHERE p.id = auth.uid()))
  )
  OR EXISTS (
    SELECT 1
    FROM public.candidates c
    WHERE c.class_id = schedule_events.class_id
      AND c.email IS NOT NULL
      AND lower(c.email) = lower((SELECT p.email FROM public.profiles p WHERE p.id = auth.uid()))
  )
);

DROP POLICY IF EXISTS "Students view own attendance" ON public.attendance_records;
CREATE POLICY "Students view own attendance"
ON public.attendance_records
FOR SELECT
TO authenticated
USING (
  candidate_id = auth.uid()
  OR EXISTS (
    SELECT 1
    FROM public.candidates c
    WHERE c.id = attendance_records.candidate_id
      AND c.email IS NOT NULL
      AND lower(c.email) = lower((SELECT p.email FROM public.profiles p WHERE p.id = auth.uid()))
  )
);

DROP POLICY IF EXISTS "Students view own makeup" ON public.makeup_assignments;
CREATE POLICY "Students view own makeup"
ON public.makeup_assignments
FOR SELECT
TO authenticated
USING (
  candidate_id = auth.uid()
  OR EXISTS (
    SELECT 1
    FROM public.candidates c
    WHERE c.id = makeup_assignments.candidate_id
      AND c.email IS NOT NULL
      AND lower(c.email) = lower((SELECT p.email FROM public.profiles p WHERE p.id = auth.uid()))
  )
);

DROP POLICY IF EXISTS "Students view own notifications" ON public.notifications;
CREATE POLICY "Students view own notifications"
ON public.notifications
FOR SELECT
TO authenticated
USING (
  candidate_id = auth.uid()
  OR EXISTS (
    SELECT 1
    FROM public.candidates c
    WHERE c.id = notifications.candidate_id
      AND c.email IS NOT NULL
      AND lower(c.email) = lower((SELECT p.email FROM public.profiles p WHERE p.id = auth.uid()))
  )
);

DROP FUNCTION IF EXISTS public.current_user_matches_candidate(uuid);
DROP FUNCTION IF EXISTS public.current_user_in_class(uuid);