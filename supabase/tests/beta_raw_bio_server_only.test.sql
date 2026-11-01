-- Local test for 20261101150000_beta_raw_bio_server_only.sql (rolled back).
-- Works in both grant modes (old auto-grant and post-2026-10-30 explicit).
begin;
do $$
declare ok boolean; n int; uid uuid := '00000000-0000-0000-0000-0000000be7b1'; sid uuid;
begin
  insert into auth.users(id, email) values (uid, 'rawbio@test.invalid');
  insert into public.profiles(id, email) values (uid, 'rawbio@test.invalid') on conflict (id) do nothing;
  insert into public.user_roles(user_id, role) values (uid, 'student') on conflict do nothing;
  insert into public.candidates(id, full_name, email, beqa_access) values (uid, 'RB', 'rawbio@test.invalid', true);
  perform set_config('app.beta_psych_assessments', 'on', true);  -- #10 write guard
  insert into public.beqa_diagnostic_sessions(student_id, assessment_type) values (uid, 'biometric') returning id into sid;

  -- R1: no client write privileges, no client INSERT policy
  if has_table_privilege('authenticated', 'public.raw_biometric_log', 'INSERT')
     or has_table_privilege('authenticated', 'public.raw_biometric_log', 'UPDATE')
     or has_table_privilege('authenticated', 'public.raw_biometric_log', 'DELETE')
     or has_table_privilege('anon', 'public.raw_biometric_log', 'INSERT')
     or has_table_privilege('anon', 'public.raw_biometric_log', 'UPDATE')
     or has_table_privilege('anon', 'public.raw_biometric_log', 'DELETE') then
    raise exception 'FAIL R1 client write privilege on raw_biometric_log'; end if;
  if exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'raw_biometric_log' and cmd in ('INSERT', 'ALL')) then
    raise exception 'FAIL R2 client insert policy remains'; end if;

  -- R3: service_role INSERT succeeds
  execute 'set local role service_role';
  insert into public.raw_biometric_log(session_id, student_id, event_type) values (sid, uid, 'svc');
  execute 'reset role';


  -- R4: authenticated INSERT of own row fails
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  ok := false;
  begin insert into public.raw_biometric_log(session_id, student_id, event_type) values (sid, uid, 'cli');
  exception when insufficient_privilege then ok := true; end;
  if not ok then raise exception 'FAIL R4 authenticated insert allowed'; end if;
  -- R5: authenticated SELECT of own rows still works
  select count(*) into n from public.raw_biometric_log where student_id = uid;
  if n <> 1 then raise exception 'FAIL R5 authenticated select own rows = %', n; end if;
  execute 'reset role';

  -- R6: even with an (accidental) INSERT grant, RLS has no insert policy
  grant insert on public.raw_biometric_log to authenticated;
  execute 'set local role authenticated';
  ok := false;
  begin insert into public.raw_biometric_log(session_id, student_id, event_type) values (sid, uid, 'cli2');
  exception when insufficient_privilege then ok := true; end;
  execute 'reset role';
  if not ok then raise exception 'FAIL R6 RLS allowed authenticated insert'; end if;
  raise notice 'PASS beta_raw_bio_server_only';
end $$;
rollback;
