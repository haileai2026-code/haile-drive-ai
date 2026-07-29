ALTER TABLE public.phone_login_requests ADD COLUMN IF NOT EXISTS otp_plain text;

DROP POLICY IF EXISTS "owner staff read phone requests" ON public.phone_login_requests;
CREATE POLICY "owner staff read phone requests"
ON public.phone_login_requests
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'owner') OR public.has_role(auth.uid(), 'staff'));

GRANT SELECT ON public.phone_login_requests TO authenticated;
GRANT ALL ON public.phone_login_requests TO service_role;