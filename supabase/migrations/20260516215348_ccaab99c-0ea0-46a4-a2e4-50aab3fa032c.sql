
DROP POLICY IF EXISTS "Students insert own sessions" ON public.beqa_diagnostic_sessions;
CREATE POLICY "Students insert own sessions" ON public.beqa_diagnostic_sessions
FOR INSERT TO authenticated
WITH CHECK (
  student_id = auth.uid()
  AND (assessment_type = 'psychological' OR public.current_user_has_beqa_access())
);

DROP POLICY IF EXISTS "Students update own sessions" ON public.beqa_diagnostic_sessions;
CREATE POLICY "Students update own sessions" ON public.beqa_diagnostic_sessions
FOR UPDATE TO authenticated
USING (
  student_id = auth.uid()
  AND (assessment_type = 'psychological' OR public.current_user_has_beqa_access())
);

DROP POLICY IF EXISTS "Students view own sessions" ON public.beqa_diagnostic_sessions;
CREATE POLICY "Students view own sessions" ON public.beqa_diagnostic_sessions
FOR SELECT TO authenticated
USING (
  student_id = auth.uid()
  AND (assessment_type = 'psychological' OR public.current_user_has_beqa_access())
);

DROP POLICY IF EXISTS "beqa access control" ON public.beqa_diagnostic_sessions;
CREATE POLICY "beqa access control" ON public.beqa_diagnostic_sessions
FOR ALL TO authenticated
USING (
  (student_id = auth.uid() AND (
    assessment_type = 'psychological'
    OR EXISTS (
      SELECT 1 FROM public.candidates
      WHERE candidates.email = (SELECT profiles.email FROM public.profiles WHERE profiles.id = auth.uid())
        AND candidates.beqa_access = true
    )
  ))
  OR EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = ANY (ARRAY['owner'::app_role, 'staff'::app_role])
  )
)
WITH CHECK (
  (student_id = auth.uid() AND (
    assessment_type = 'psychological'
    OR EXISTS (
      SELECT 1 FROM public.candidates
      WHERE candidates.email = (SELECT profiles.email FROM public.profiles WHERE profiles.id = auth.uid())
        AND candidates.beqa_access = true
    )
  ))
  OR EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = ANY (ARRAY['owner'::app_role, 'staff'::app_role])
  )
);
