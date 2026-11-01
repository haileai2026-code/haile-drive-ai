-- Local test for 20261101150000_beta_raw_bio_server_only.sql (rolled back).
-- Works in both grant modes (old auto-grant and post-2026-10-30 explicit).
begin;
do $$
declare ok boolean; n int; pr text; uid uuid := '00000000-0000-0000-0000-0000000be7b1'; sid uuid;
        tid uuid := '00000000-0000-0000-0000-0000000be7b2'; cid uuid;
begin
  insert into auth.users(id, email) values (uid, 'rawbio@test.invalid');
  insert into public.profiles(id, email) values (uid, 'rawbio@test.invalid') on conflict (id) do nothing;
  insert into public.user_roles(user_id, role) values (uid, 'student') on conflict do nothing;
  insert into public.candidates(id, full_name, email, beqa_access) values (uid, 'RB', 'rawbio@test.invalid', true);
  -- fix/sec-candidates-rls (#4) links candidates by user_id
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'candidates' and column_name = 'user_id') then
    execute 'update public.candidates set user_id = $1 where id = $1' using uid;
  end if;
  -- teacher of the student's class (both teacher models: class + assigned_teacher_id)
  insert into auth.users(id, email) values (tid, 'rawbio-t@test.invalid');
  insert into public.profiles(id, email) values (tid, 'rawbio-t@test.invalid') on conflict (id) do nothing;
  insert into public.user_roles(user_id, role) values (tid, 'teacher') on conflict do nothing;
  insert into public.classes(name, teacher_id) values ('RB class', tid) returning id into cid;
  update public.candidates set class_id = cid, assigned_teacher_id = tid where id = uid;
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

  -- R2b: no TRUNCATE/REFERENCES/TRIGGER (MAINTAIN on PG17+), no anon SELECT, RLS forced
  foreach pr in array array['TRUNCATE', 'REFERENCES', 'TRIGGER'] loop
    if has_table_privilege('anon', 'public.raw_biometric_log', pr)
       or has_table_privilege('authenticated', 'public.raw_biometric_log', pr) then
      raise exception 'FAIL R2b client % privilege', pr; end if;
  end loop;
  if current_setting('server_version_num')::int >= 170000 then
    execute $q$select has_table_privilege('anon', 'public.raw_biometric_log', 'MAINTAIN')
      or has_table_privilege('authenticated', 'public.raw_biometric_log', 'MAINTAIN')$q$ into ok;
    if ok then raise exception 'FAIL R2b client MAINTAIN privilege'; end if;
  end if;
  if has_table_privilege('anon', 'public.raw_biometric_log', 'SELECT') then
    raise exception 'FAIL R2c anon SELECT privilege'; end if;
  if not (select relforcerowsecurity from pg_class where oid = 'public.raw_biometric_log'::regclass) then
    raise exception 'FAIL R2d RLS not forced'; end if;

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
  -- R5b/R5c: authenticated UPDATE / DELETE of own rows fail
  ok := false;
  begin update public.raw_biometric_log set event_type = 'x' where student_id = uid;
  exception when insufficient_privilege then ok := true; end;
  if not ok then raise exception 'FAIL R5b authenticated update allowed'; end if;
  ok := false;
  begin delete from public.raw_biometric_log where student_id = uid;
  exception when insufficient_privilege then ok := true; end;
  if not ok then raise exception 'FAIL R5c authenticated delete allowed'; end if;
  execute 'reset role';

  -- R7/R8: anon INSERT and SELECT denied
  perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
  execute 'set local role anon';
  ok := false;
  begin insert into public.raw_biometric_log(session_id, student_id, event_type) values (sid, uid, 'anon');
  exception when insufficient_privilege then ok := true; end;
  if not ok then raise exception 'FAIL R7 anon insert allowed'; end if;
  ok := false;
  begin perform count(*) from public.raw_biometric_log;
  exception when insufficient_privilege then ok := true; end;
  if not ok then raise exception 'FAIL R8 anon select allowed'; end if;
  execute 'reset role';
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);

  -- R9: teacher of the student's class sees 0 rows (CTO: no teacher access)
  if exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'raw_biometric_log'
             and policyname in ('Teachers view their students bio log', 'raw_bio_teacher_select')) then
    raise exception 'FAIL R9a teacher policy remains'; end if;
  perform set_config('request.jwt.claims', json_build_object('sub', tid, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  select count(*) into n from public.raw_biometric_log where student_id = uid;
  execute 'reset role';
  if n <> 0 then raise exception 'FAIL R9b teacher sees % bio rows', n; end if;
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);

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
