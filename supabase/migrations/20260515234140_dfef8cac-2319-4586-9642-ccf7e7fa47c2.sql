
ALTER TABLE public.candidates
  ADD COLUMN IF NOT EXISTS beqa_access boolean NOT NULL DEFAULT false;

-- Helper: does the current auth user have beqa_access on their candidate row?
CREATE OR REPLACE FUNCTION public.current_user_has_beqa_access()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.candidates c
    JOIN public.profiles p ON p.id = auth.uid()
    WHERE c.beqa_access = true
      AND (
        c.id = auth.uid()
        OR (c.email IS NOT NULL AND lower(c.email) = lower(p.email))
      )
  )
$$;

-- Tighten beqa_diagnostic_sessions: students can only insert/select if they have access
DROP POLICY IF EXISTS "Students insert own sessions" ON public.beqa_diagnostic_sessions;
CREATE POLICY "Students insert own sessions"
ON public.beqa_diagnostic_sessions
FOR INSERT TO authenticated
WITH CHECK (student_id = auth.uid() AND public.current_user_has_beqa_access());

DROP POLICY IF EXISTS "Students update own sessions" ON public.beqa_diagnostic_sessions;
CREATE POLICY "Students update own sessions"
ON public.beqa_diagnostic_sessions
FOR UPDATE TO authenticated
USING (student_id = auth.uid() AND public.current_user_has_beqa_access());

DROP POLICY IF EXISTS "Students view own sessions" ON public.beqa_diagnostic_sessions;
CREATE POLICY "Students view own sessions"
ON public.beqa_diagnostic_sessions
FOR SELECT TO authenticated
USING (student_id = auth.uid() AND public.current_user_has_beqa_access());

-- Same for raw_biometric_log
DROP POLICY IF EXISTS "Students insert own bio log" ON public.raw_biometric_log;
CREATE POLICY "Students insert own bio log"
ON public.raw_biometric_log
FOR INSERT TO authenticated
WITH CHECK (student_id = auth.uid() AND public.current_user_has_beqa_access());

DROP POLICY IF EXISTS "Students view own bio log" ON public.raw_biometric_log;
CREATE POLICY "Students view own bio log"
ON public.raw_biometric_log
FOR SELECT TO authenticated
USING (student_id = auth.uid() AND public.current_user_has_beqa_access());
