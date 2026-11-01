-- Re-schedule the 'notifications-tick' cron job without a hardcoded URL.
--
-- Before: 20260513224327_* scheduled net.http_post() against a literal
-- preview-deployment URL and sent no x-cron-secret header, so the endpoint
-- (src/routes/api/public/hooks/notifications-tick.ts) always answered 401.
--
-- Now the job calls public.notifications_tick(), which resolves at run time:
--   URL    : Vault secret 'notifications_tick_url'
--            fallback current_setting('app.notifications_tick_url', true)
--   secret : Vault secret 'notifications_tick_secret' (must equal CRON_SECRET
--            in the Vercel server env), sent as header x-cron-secret
--            fallback current_setting('app.notifications_tick_secret', true)
-- If the URL or the secret is missing it fails closed: RAISE NOTICE, no call.
-- Values are NOT stored in this repo; a human creates the Vault secrets:
--   select vault.create_secret('<https url>', 'notifications_tick_url');
--   select vault.create_secret('<CRON_SECRET>', 'notifications_tick_secret');
-- Idempotent / re-runnable. Rollback:
--   supabase/rollback/20261101120000_notifications_tick_url_config.down.sql

create extension if not exists pg_cron;
create extension if not exists pg_net;

create or replace function public.notifications_tick()
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_url    text;
  v_secret text;
begin
  select ds.decrypted_secret into v_url
    from vault.decrypted_secrets ds where ds.name = 'notifications_tick_url' limit 1;
  v_url := coalesce(nullif(btrim(v_url), ''),
                    nullif(btrim(current_setting('app.notifications_tick_url', true)), ''));

  select ds.decrypted_secret into v_secret
    from vault.decrypted_secrets ds where ds.name = 'notifications_tick_secret' limit 1;
  v_secret := coalesce(nullif(v_secret, ''),
                       nullif(current_setting('app.notifications_tick_secret', true), ''));

  if v_url is null or v_url !~ '^https://' then
    raise notice 'notifications_tick: no valid https URL configured (vault notifications_tick_url / app.notifications_tick_url); skipping';
    return null;
  end if;
  if v_secret is null then
    raise notice 'notifications_tick: no cron secret configured (vault notifications_tick_secret); skipping';
    return null;
  end if;

  return net.http_post(
    url     := v_url,
    body    := '{}'::jsonb,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', v_secret)
  );
end;
$$;

-- Explicit grants (Supabase 2026-10-30): nobody but the owner (cron runs as
-- postgres). No client role may trigger the tick or read the secret path.
revoke all on function public.notifications_tick() from public, anon, authenticated, service_role;

do $$
begin
  perform cron.unschedule('notifications-tick');
exception when others then null;
end $$;

select cron.schedule('notifications-tick', '*/5 * * * *', $cron$ select public.notifications_tick(); $cron$);
