-- Fix 1: Set search_path on calculate_haile_readiness_score
ALTER FUNCTION public.calculate_haile_readiness_score(uuid) SET search_path = public;

-- Fix 2: Remove permissive anon INSERT policy on phone_login_requests.
-- OTP rows are created server-side via service-role (supabaseAdmin), which bypasses RLS,
-- so no anon-callable INSERT policy is needed. Removing it closes an auth-bypass vector
-- where an attacker could pre-seed (phone, otp_code) pairs.
DROP POLICY IF EXISTS "anyone can insert phone request" ON public.phone_login_requests;