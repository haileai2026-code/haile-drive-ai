-- Local-stub test (net.http_post records into net.calls; vault stub tables).
begin;
do $$
declare n int; h jsonb; u text; ts1 timestamptz;
begin
  -- S1: migration ran without Vault secrets -> old job removed, new job NOT scheduled
  if exists (select 1 from cron.job where jobname='notifications-tick') then
    raise exception 'FAIL S1 job scheduled without secrets / old job kept'; end if;
  -- S2: an old-style job is always removed, even if secrets are missing
  insert into cron.job(jobname, schedule, command) values ('notifications-tick', '*/5 * * * *', 'select net.http_post(url:=''https://old-preview.example.invalid/api'')');
  if public.notifications_tick_schedule() then raise exception 'FAIL S2 scheduled without secrets'; end if;
  if exists (select 1 from cron.job where jobname='notifications-tick') then raise exception 'FAIL S2b old job kept'; end if;
  -- S2c: an unrelated job is never touched
  insert into cron.job(jobname, schedule, command) values ('other-job', '0 * * * *', 'select 1');
  perform public.notifications_tick_schedule();
  if not exists (select 1 from cron.job where jobname='other-job') then raise exception 'FAIL S2c unrelated job removed'; end if;
  delete from cron.job where jobname='other-job';
  -- S3: both secrets -> scheduled exactly once (re-runnable)
  insert into vault.secrets(name, secret) values ('notifications_tick_url', 'https://example.test/api/public/hooks/notifications-tick'),
                                                 ('notifications_tick_secret', 'test-cron-secret');
  if not public.notifications_tick_schedule() then raise exception 'FAIL S3 not scheduled'; end if;
  perform public.notifications_tick_schedule();
  if (select count(*) from cron.job where jobname='notifications-tick') <> 1 then raise exception 'FAIL 1 job count'; end if;
  if (select command from cron.job where jobname='notifications-tick') ~ 'https?://' then raise exception 'FAIL 2 literal URL in job'; end if;
  if (select command from cron.job where jobname='notifications-tick') !~ 'public\.notifications_tick\(\)' then raise exception 'FAIL 3 job command'; end if;
  foreach u in array array['anon','authenticated','service_role'] loop
    if has_function_privilege(u, 'public.notifications_tick()', 'EXECUTE') then raise exception 'FAIL 4 % can execute', u; end if;
    if has_function_privilege(u, 'public.notifications_tick_schedule()', 'EXECUTE') then raise exception 'FAIL 4b % can schedule', u; end if;
    if has_table_privilege(u, 'public.notifications_tick_state', 'SELECT,INSERT,UPDATE,DELETE') then raise exception 'FAIL 4c % state table', u; end if;
  end loop;
  delete from vault.secrets;

  -- nothing configured -> fail closed, no call
  delete from net.calls;
  perform public.notifications_tick();
  if (select count(*) from net.calls) <> 0 then raise exception 'FAIL 5 called without config'; end if;
  -- T1: notice throttled - state set once, not advanced on the next run
  select last_notice_at into ts1 from public.notifications_tick_state;
  if ts1 is null then raise exception 'FAIL T1 no throttle state'; end if;
  update public.notifications_tick_state set last_notice_at = now() - interval '10 minutes';
  perform public.notifications_tick();
  if (select last_notice_at from public.notifications_tick_state) <> now() - interval '10 minutes' then raise exception 'FAIL T2 notice not throttled'; end if;

  -- URL only, no secret -> no call
  insert into vault.secrets(name, secret) values ('notifications_tick_url', 'https://example.test/api/public/hooks/notifications-tick');
  perform public.notifications_tick();
  if (select count(*) from net.calls) <> 0 then raise exception 'FAIL 6 called without secret'; end if;

  -- both -> exactly one call with header
  insert into vault.secrets(name, secret) values ('notifications_tick_secret', 'test-cron-secret');
  perform public.notifications_tick();
  select count(*) into n from net.calls;
  if n <> 1 then raise exception 'FAIL 7 calls=%', n; end if;
  select url, headers into u, h from net.calls limit 1;
  if u <> 'https://example.test/api/public/hooks/notifications-tick' or h->>'x-cron-secret' <> 'test-cron-secret' then raise exception 'FAIL 8 % %', u, h; end if;

  -- non-https URL rejected; GUC fallback works
  delete from net.calls; delete from vault.secrets where name='notifications_tick_url';
  perform set_config('app.notifications_tick_url', 'http://insecure.test/x', true);
  perform public.notifications_tick();
  if (select count(*) from net.calls) <> 0 then raise exception 'FAIL 9 http accepted'; end if;
  perform set_config('app.notifications_tick_url', 'https://fallback.test/x', true);
  perform public.notifications_tick();
  if (select url from net.calls) <> 'https://fallback.test/x' then raise exception 'FAIL 10 GUC fallback'; end if;
  raise notice 'PASS notifications_tick_url_config';
end $$;
rollback;
