-- Grants rollback for 20260925120200_sec_otp_hardening.sql (explicit grants only).
-- Revokes the grants the migration adds; does not drop functions/columns or
-- restore old default grants. Run manually; re-runnable.
revoke execute on function public.phone_otp_request_allowed(text) from service_role;
revoke execute on function public.phone_otp_verify(text, text)     from service_role;
revoke execute on function public.purge_phone_otps()               from service_role;
revoke select on public.phone_login_requests from authenticated;
revoke select, insert, update, delete on public.phone_login_requests from service_role;
