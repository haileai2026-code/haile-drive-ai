
-- 1. Hash phone OTPs
ALTER TABLE public.phone_login_requests
  ADD COLUMN IF NOT EXISTS otp_hash text;

UPDATE public.phone_login_requests
  SET otp_hash = encode(digest(otp_code, 'sha256'), 'hex')
  WHERE otp_hash IS NULL AND otp_code IS NOT NULL;

ALTER TABLE public.phone_login_requests
  DROP COLUMN IF EXISTS otp_code;

-- 2. Restrict BEQA update policy to in-progress sessions
DROP POLICY IF EXISTS "student can update own in-progress session" ON public.beqa_diagnostic_sessions;
CREATE POLICY "student can update own in-progress session"
ON public.beqa_diagnostic_sessions
FOR UPDATE
TO authenticated
USING (student_id = auth.uid() AND current_user_has_beqa_access() AND end_time IS NULL)
WITH CHECK (student_id = auth.uid() AND current_user_has_beqa_access() AND end_time IS NULL);

-- 3. Make has_role SECURITY DEFINER so cross-user role checks work in RLS
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$function$;
