
-- schedule_events
DROP POLICY IF EXISTS "Students view own schedule" ON public.schedule_events;
CREATE POLICY "Students view own schedule"
ON public.schedule_events FOR SELECT TO authenticated
USING (
  (candidate_id = auth.uid())
  OR EXISTS (
    SELECT 1 FROM candidates c
    WHERE c.id = schedule_events.candidate_id
      AND lower(c.email) = lower((SELECT p.email FROM profiles p WHERE p.id = auth.uid()))
  )
  OR EXISTS (
    SELECT 1 FROM candidates c
    WHERE c.class_id = schedule_events.class_id
      AND (c.id = auth.uid()
        OR lower(c.email) = lower((SELECT p.email FROM profiles p WHERE p.id = auth.uid())))
  )
);

-- attendance_records
DROP POLICY IF EXISTS "Students view own attendance" ON public.attendance_records;
CREATE POLICY "Students view own attendance"
ON public.attendance_records FOR SELECT TO authenticated
USING (
  (candidate_id = auth.uid())
  OR EXISTS (
    SELECT 1 FROM candidates c
    WHERE c.id = attendance_records.candidate_id
      AND lower(c.email) = lower((SELECT p.email FROM profiles p WHERE p.id = auth.uid()))
  )
);

-- makeup_assignments
DROP POLICY IF EXISTS "Students view own makeup" ON public.makeup_assignments;
CREATE POLICY "Students view own makeup"
ON public.makeup_assignments FOR SELECT TO authenticated
USING (
  (candidate_id = auth.uid())
  OR EXISTS (
    SELECT 1 FROM candidates c
    WHERE c.id = makeup_assignments.candidate_id
      AND lower(c.email) = lower((SELECT p.email FROM profiles p WHERE p.id = auth.uid()))
  )
);

-- notifications
DROP POLICY IF EXISTS "Students view own notifications" ON public.notifications;
CREATE POLICY "Students view own notifications"
ON public.notifications FOR SELECT TO authenticated
USING (
  (candidate_id = auth.uid())
  OR EXISTS (
    SELECT 1 FROM candidates c
    WHERE c.id = notifications.candidate_id
      AND lower(c.email) = lower((SELECT p.email FROM profiles p WHERE p.id = auth.uid()))
  )
);

-- Normalize existing candidate emails to lowercase to prevent future mismatches
UPDATE public.candidates SET email = lower(email) WHERE email IS NOT NULL AND email <> lower(email);
