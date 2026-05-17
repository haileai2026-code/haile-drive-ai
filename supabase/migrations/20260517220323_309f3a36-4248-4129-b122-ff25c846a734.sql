CREATE TABLE public.phone_login_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone text NOT NULL,
  otp_code text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','used')),
  user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '10 minutes')
);

CREATE INDEX phone_login_requests_phone_idx ON public.phone_login_requests (phone);
CREATE INDEX phone_login_requests_status_idx ON public.phone_login_requests (status);

ALTER TABLE public.phone_login_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner staff manage phone requests"
ON public.phone_login_requests
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'staff'::app_role))
WITH CHECK (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'staff'::app_role));

CREATE POLICY "anyone can insert phone request"
ON public.phone_login_requests
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

CREATE TRIGGER phone_login_requests_set_updated_at
BEFORE UPDATE ON public.phone_login_requests
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();