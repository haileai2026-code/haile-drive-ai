-- feat/consent-record: append-only consents with own/staff visibility.
-- Run ONLY against a local / branch DB as postgres; rolled back at the end.
-- Synthetic users only.
begin;

do $$
declare
  u1 uuid := '00000000-0000-0000-0000-0000000c0501';
  u2 uuid := '00000000-0000-0000-0000-0000000c0502';
  st uuid := '00000000-0000-0000-0000-0000000c0503';
  n int; ok boolean; rid uuid; ts timestamptz;
begin
  insert into auth.users(id, email) values (u1, 'c1@test.local'), (u2, 'c2@test.local'), (st, 'st@test.local');
  insert into public.user_roles(user_id, role) values (st, 'staff');

  -- K1: no UPDATE/DELETE privilege or policy for client roles
  if has_table_privilege('authenticated', 'public.consents', 'UPDATE')
     or has_table_privilege('authenticated', 'public.consents', 'DELETE')
     or has_table_privilege('anon', 'public.consents', 'SELECT')
     or has_table_privilege('anon', 'public.consents', 'INSERT') then
    raise exception 'FAIL K1: forbidden privilege present';
  end if;
  select count(*) into n from pg_policies
   where schemaname = 'public' and tablename = 'consents' and cmd in ('UPDATE', 'DELETE', 'ALL');
  if n <> 0 then raise exception 'FAIL K1b: UPDATE/DELETE/ALL policy exists'; end if;

  -- K2: user inserts own consent (user_id defaults to auth.uid(); created_at is server time)
  perform set_config('request.jwt.claims', json_build_object('sub', u1, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  insert into public.consents(consent_type, granted, notice_version, terms_version, checkbox_version, language, created_at)
    values ('privacy_terms_abroad', true, 'campus-privacy-v0.4', 'campus-terms-beta-v0.4', 'campus-consent-v0.3-he', 'he', '2000-01-01')
    returning id, created_at into rid, ts;
  execute 'reset role';
  if ts < now() - interval '1 minute' then raise exception 'FAIL K2: client could backdate created_at'; end if;

  -- K3: user cannot insert for someone else
  ok := false;
  begin
    execute 'set local role authenticated';
    insert into public.consents(user_id, consent_type, granted, notice_version, terms_version, checkbox_version, language)
      values (u2, 'privacy_terms_abroad', true, 'v', 't', 'c', 'he');
  exception when insufficient_privilege or check_violation then ok := true;
  end;
  execute 'reset role';
  if not ok then raise exception 'FAIL K3: insert for another user allowed'; end if;

  -- K4: UPDATE / DELETE by the owner are refused
  ok := false;
  begin
    execute 'set local role authenticated';
    update public.consents set granted = false where id = rid;
  exception when insufficient_privilege then ok := true;
  end;
  execute 'reset role';
  if not ok then raise exception 'FAIL K4: update allowed'; end if;
  ok := false;
  begin
    execute 'set local role authenticated';
    delete from public.consents where id = rid;
  exception when insufficient_privilege then ok := true;
  end;
  execute 'reset role';
  if not ok then raise exception 'FAIL K4b: delete allowed'; end if;

  -- K5: append-only even for postgres/service role (trigger)
  ok := false;
  begin
    update public.consents set granted = false where id = rid;
  exception when raise_exception then ok := true;
  end;
  if not ok then raise exception 'FAIL K5: update not blocked by trigger'; end if;

  -- K6: checkbox 1 requires terms_version; language restricted
  ok := false;
  begin
    insert into public.consents(user_id, consent_type, granted, notice_version, checkbox_version, language)
      values (u1, 'privacy_terms_abroad', true, 'v', 'c', 'he');
  exception when check_violation then ok := true;
  end;
  if not ok then raise exception 'FAIL K6: checkbox 1 without terms_version accepted'; end if;

  -- K7: another user cannot see u1's rows; staff can
  perform set_config('request.jwt.claims', json_build_object('sub', u2, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  select count(*) into n from public.consents;
  execute 'reset role';
  if n <> 0 then raise exception 'FAIL K7: other user sees consents'; end if;

  perform set_config('request.jwt.claims', json_build_object('sub', st, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  select count(*) into n from public.consents;
  execute 'reset role';
  if n <> 1 then raise exception 'FAIL K8: staff cannot read consents (%)', n; end if;

  -- K9: anon sees nothing / cannot insert
  ok := false;
  begin
    execute 'set local role anon';
    select count(*) into n from public.consents;
  exception when insufficient_privilege then ok := true;
  end;
  execute 'reset role';
  if not ok then raise exception 'FAIL K9: anon can read consents'; end if;

  raise notice 'PASS consent_record';
end $$;
rollback;
