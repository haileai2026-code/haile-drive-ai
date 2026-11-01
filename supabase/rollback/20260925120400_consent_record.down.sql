-- Grants rollback for 20260925120400_consent_record.sql (explicit grants only).
-- Revokes the grants the migration adds. It does not drop public.consents
-- (consent history must not be deleted). Run manually; re-runnable.
revoke select, insert on public.consents from authenticated;
revoke select on public.consents from service_role;
