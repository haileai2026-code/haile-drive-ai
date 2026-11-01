-- R4-1: course_enrollments progress is server-computed; own update needs consent.
-- Run ONLY against a local / branch DB as postgres; rolled back at the end. Synthetic users only.
begin;
do $$
declare
  s1 uuid := '00000000-0000-0000-0000-0000000e0401';
  s2 uuid := '00000000-0000-0000-0000-0000000e0402';
  st uuid := '00000000-0000-0000-0000-0000000e0403';
  c uuid := '00000000-0000-0000-0000-0000000e04c1';
  m uuid := '00000000-0000-0000-0000-0000000e04d1';
  l1 uuid := '00000000-0000-0000-0000-0000000e04e1';
  l2 uuid := '00000000-0000-0000-0000-0000000e04e2';
  e1 uuid := '00000000-0000-0000-0000-0000000e04f1';
  e2 uuid := '00000000-0000-0000-0000-0000000e04f2';
  web jsonb := '{"ip_hash":"00ff","user_agent":"t"}';
  ok boolean; n int; pct numeric; r record;
begin
  insert into auth.users(id, email) values (s1,'e1@test.local'),(s2,'e2@test.local'),(st,'est@test.local');
  insert into public.user_roles(user_id, role) values (s1,'student'),(s2,'student'),(st,'staff');
  insert into public.online_courses(id, title_he, status) values (c, 'T', 'published');
  insert into public.course_modules(id, course_id, title_he) values (m, c, 'M');
  insert into public.course_lessons(id, module_id, title_he) values (l1, m, 'L1'), (l2, m, 'L2');
  insert into public.course_enrollments(id, course_id, student_id) values (e1, c, s1), (e2, c, s2);
  execute 'set local role service_role';
  perform public.record_consent(s1, null, 'privacy_terms_abroad', true, 'campus-privacy-v0.4',
          'campus-terms-beta-v0.4', 'campus-consent-v0.3-he', 'he', 'web', web);
  execute 'reset role';

  -- E1: student with consent cannot set progress fields directly
  perform set_config('request.jwt.claims', json_build_object('sub', s1, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  ok := false;
  begin update public.course_enrollments set progress_pct = 100 where id = e1;
  exception when insufficient_privilege then ok := true; end;
  if not ok then raise exception 'FAIL E1 progress_pct'; end if;
  ok := false;
  begin update public.course_enrollments set status = 'completed', completed_at = now() where id = e1;
  exception when insufficient_privilege then ok := true; end;
  if not ok then raise exception 'FAIL E1b status/completed_at'; end if;
  raise notice 'PASS E1 direct progress update rejected';

  -- E2: recompute derives from lesson progress
  insert into public.course_lesson_progress(enrollment_id, lesson_id, status) values (e1, l1, 'completed');
  pct := public.recompute_course_progress(e1);
  if pct <> 50 then raise exception 'FAIL E2 pct=%', pct; end if;
  insert into public.course_lesson_progress(enrollment_id, lesson_id, status) values (e1, l2, 'completed');
  pct := public.recompute_course_progress(e1);
  select * into r from public.course_enrollments where id = e1;
  if pct <> 100 or r.status <> 'completed' or r.completed_at is null then raise exception 'FAIL E2b'; end if;
  raise notice 'PASS E2 recompute_course_progress';

  -- E3: cannot recompute someone else's enrollment
  ok := false;
  begin perform public.recompute_course_progress(e2);
  exception when insufficient_privilege then ok := true; end;
  if not ok then raise exception 'FAIL E3'; end if;
  raise notice 'PASS E3 foreign enrollment rejected';
  execute 'reset role';

  -- E4: student without consent: own update policy matches no row; recompute refused
  perform set_config('request.jwt.claims', json_build_object('sub', s2, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  update public.course_enrollments set updated_at = now() where id = e2;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL E4 update without consent'; end if;
  ok := false;
  begin perform public.recompute_course_progress(e2);
  exception when insufficient_privilege then ok := true; end;
  if not ok then raise exception 'FAIL E4b'; end if;
  raise notice 'PASS E4 no consent -> no update';
  execute 'reset role';

  -- E5: staff may still edit progress directly
  perform set_config('request.jwt.claims', json_build_object('sub', st, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  update public.course_enrollments set status = 'cancelled' where id = e2;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'FAIL E5 staff'; end if;
  raise notice 'PASS E5 staff update';
  execute 'reset role';

  -- E6: privileges
  if has_function_privilege('anon', 'public.recompute_course_progress(uuid)', 'EXECUTE') then
    raise exception 'FAIL E6 anon execute'; end if;
  if not has_function_privilege('authenticated', 'public.recompute_course_progress(uuid)', 'EXECUTE') then
    raise exception 'FAIL E6b authenticated execute'; end if;
  raise notice 'PASS E6 grants';

  -- E7 (round 5 NIT): missing and forbidden enrollments raise the same error
  declare m1 text; m2 text; begin
    perform set_config('request.jwt.claims', json_build_object('sub', s2, 'role', 'authenticated')::text, true);
    execute 'set local role authenticated';
    begin perform public.recompute_course_progress(e2);
    exception when insufficient_privilege then get stacked diagnostics m1 = message_text; end;
    begin perform public.recompute_course_progress(gen_random_uuid());
    exception when insufficient_privilege then get stacked diagnostics m2 = message_text; end;
    execute 'reset role';
    if m1 is null or m1 is distinct from m2 then raise exception 'FAIL E7 % / %', m1, m2; end if;
  end;
  raise notice 'PASS E7 unified not-found/not-allowed';

  -- E8 (round 5 NIT): search_path = '' on the definer + guard functions
  if exists (select 1 from pg_proc where oid in ('public.recompute_course_progress(uuid)'::regprocedure,
             'public.course_enrollments_guard()'::regprocedure)
             and not (coalesce(proconfig, '{}') @> array['search_path=""'])) then
    raise exception 'FAIL E8 search_path'; end if;
  raise notice 'PASS E8 search_path empty';
end $$;
rollback;
