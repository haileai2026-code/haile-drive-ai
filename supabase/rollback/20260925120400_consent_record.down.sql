-- Grants rollback for 20260925120400_consent_record.sql (explicit grants only).
-- Revokes the grants the migration adds and unschedules the retention purge.
-- It does not drop public.consents or its columns (consent history must not
-- be deleted). Run manually; re-runnable.
do $$ begin perform cron.unschedule('consents-retention-purge'); exception when others then null; end $$;
revoke select on public.consents from authenticated;
revoke select, insert, delete on public.consents from service_role;
revoke execute on function public.consent_version_allowed(text, text, text, text) from service_role;
revoke execute on function public.record_consent(uuid, uuid, text, boolean, text, text, text, text, text, jsonb) from service_role;
revoke execute on function public.consent_ok(uuid) from service_role;
revoke execute on function public.purge_expired_consents() from service_role;
