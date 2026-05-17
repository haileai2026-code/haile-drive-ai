DROP POLICY IF EXISTS "beqa access control" ON public.beqa_diagnostic_sessions;
DROP POLICY IF EXISTS "Students view own sessions" ON public.beqa_diagnostic_sessions;
DROP POLICY IF EXISTS "Students update own sessions" ON public.beqa_diagnostic_sessions;
DROP POLICY IF EXISTS "Students insert own sessions" ON public.beqa_diagnostic_sessions;
DROP POLICY IF EXISTS "Owners staff view all sessions" ON public.beqa_diagnostic_sessions;
DROP POLICY IF EXISTS "Teachers view their students sessions" ON public.beqa_diagnostic_sessions;
DROP POLICY IF EXISTS "Owners delete sessions" ON public.beqa_diagnostic_sessions;

CREATE POLICY "student can insert beqa"
ON public.beqa_diagnostic_sessions
FOR INSERT
TO authenticated
WITH CHECK (student_id = auth.uid());

CREATE POLICY "student can update own in-progress session"
ON public.beqa_diagnostic_sessions
FOR UPDATE
TO authenticated
USING (student_id = auth.uid())
WITH CHECK (student_id = auth.uid());

CREATE POLICY "staff reads all beqa"
ON public.beqa_diagnostic_sessions
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role IN ('owner','staff','teacher')
  )
);

CREATE POLICY "owners delete beqa"
ON public.beqa_diagnostic_sessions
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'owner'::app_role));