-- Local-stub test (net.http_post records into net.calls; vault stub tables).
begin;
do $$
declare n int; h jsonb; u text;
begin
  if (select count(*) from cron.job where jobname='notifications-tick') <> 1 then raise exception 'FAIL 1 job count'; end if;
  if (select command from cron.job where jobname='notifications-tick') ~ 'https?://' then raise exception 'FAIL 2 literal URL in job'; end if;
  if (select command from cron.job where jobname='notifications-tick') !~ 'public\.notifications_tick\(\)' then raise exception 'FAIL 3 job command'; end if;
  foreach u in array array['anon','authenticated','service_role'] loop
    if has_function_privilege(u, 'public.notifications_tick()', 'EXECUTE') then raise exception 'FAIL 4 % can execute', u; end if;
  end loop;

  -- nothing configured -> fail closed, no call
  delete from net.calls;
  perform public.notifications_tick();
  if (select count(*) from net.calls) <> 0 then raise exception 'FAIL 5 called without config'; end if;

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
