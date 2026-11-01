-- Rollback for 20261101120000_notifications_tick_url_config.sql. Run manually.
-- Unschedules the job and drops the function. Does NOT restore the old
-- hardcoded-URL job (re-create it manually only if really needed).
do $$ begin perform cron.unschedule('notifications-tick'); exception when others then null; end $$;
drop function if exists public.notifications_tick();
