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
-- If the URL or the secret is missing it fails closed: no call, and at most
-- one NOTICE per hour (state in public.notifications_tick_state), no spam.
--
-- Scheduling (review fix, CTO 2026-11-01): the old job (hardcoded preview URL)
-- is ALWAYS unscheduled (exact jobname 'notifications-tick'). The new job is scheduled ONLY if both Vault secrets
-- exist at migration time; otherwise it stays unscheduled with a NOTICE.
-- Manual step after a human creates both secrets (as postgres):
--   select public.notifications_tick_schedule();
-- Values are NOT stored in this repo; a human creates the Vault secrets:
--   select vault.create_secret('<https url>', 'notifications_tick_url');
--   select vault.create_secret('<CRON_SECRET>', 'notifications_tick_secret');
-- Idempotent / re-runnable. Rollback:
--   supabase/rollback/20261101120000_notifications_tick_url_config.down.sql

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Throttle state for the fail-closed notice (singleton row, owner only).
create table if not exists public.notifications_tick_state (
  id             boolean primary key default true check (id),
  last_notice_at timestamptz
);
alter table public.notifications_tick_state enable row level security;
revoke all on table public.notifications_tick_state from public, anon, authenticated, service_role;

create or replace function public.notifications_tick()
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_url    text;
  v_secret text;
  v_last   timestamptz;
begin
  select ds.decrypted_secret into v_url
    from vault.decrypted_secrets ds where ds.name = 'notifications_tick_url' limit 1;
  v_url := coalesce(nullif(btrim(v_url), ''),
                    nullif(btrim(current_setting('app.notifications_tick_url', true)), ''));

  select ds.decrypted_secret into v_secret
    from vault.decrypted_secrets ds where ds.name = 'notifications_tick_secret' limit 1;
  v_secret := coalesce(nullif(v_secret, ''),
                       nullif(current_setting('app.notifications_tick_secret', true), ''));

  if v_url is null or v_url !~ '^https://' or v_secret is null then
    -- fail closed; log at most once per hour
    select last_notice_at into v_last from public.notifications_tick_state where id;
    if v_last is null or v_last < now() - interval '1 hour' then
      insert into public.notifications_tick_state(id, last_notice_at) values (true, now())
        on conflict (id) do update set last_notice_at = excluded.last_notice_at;
      raise notice 'notifications_tick: URL (https) or cron secret not configured (vault notifications_tick_url / notifications_tick_secret); skipping';
    end if;
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


-- Schedule helper: always removes the old job(s), schedules the new one only
-- when both Vault secrets exist. Returns true when scheduled.
create or replace function public.notifications_tick_schedule()
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  j record;
begin
  -- always drop the old job, by its exact name from 20260513224327
  -- ('notifications-tick', which posted to the hardcoded preview URL)
  for j in select jobid, jobname from cron.job where jobname = 'notifications-tick' loop
    begin
      perform cron.unschedule(j.jobname);
    exception when others then
      raise notice 'notifications_tick_schedule: could not unschedule job % (%)', j.jobid, sqlerrm;
    end;
  end loop;

  if (select count(distinct ds.name) from vault.decrypted_secrets ds
       where ds.name in ('notifications_tick_url', 'notifications_tick_secret')
         and nullif(btrim(ds.decrypted_secret), '') is not null) < 2 then
    raise notice 'notifications-tick NOT scheduled: create Vault secrets notifications_tick_url and notifications_tick_secret, then run: select public.notifications_tick_schedule();';
    return false;
  end if;

  perform cron.schedule('notifications-tick', '*/5 * * * *', $cron$ select public.notifications_tick(); $cron$);
  return true;
end;
$$;
revoke all on function public.notifications_tick_schedule() from public, anon, authenticated, service_role;

select public.notifications_tick_schedule();
