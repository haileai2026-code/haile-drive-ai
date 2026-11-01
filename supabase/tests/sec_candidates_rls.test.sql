-- =====================================================================
-- fix/sec-candidates-rls : negative/positive RLS tests
-- Derived from the VERIFICATION block of fix-sec-candidates-rls-SPEC.sql.
-- Run ONLY against a local / branch database as postgres, e.g.
--   psql "$LOCAL_DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/sec_candidates_rls.test.sql
-- Everything runs in ONE transaction that is ROLLED BACK at the end.
-- Synthetic UUIDs and *.test.invalid addresses only; no real data is read
-- (no SELECT of real rows is printed; counts are filtered to fixture ids).
-- Every check RAISEs EXCEPTION on failure, so the script aborts on the first
-- failing expectation; "expect ERROR" cases are caught inside their DO block.
--
-- Enum labels verified against migrations:
--   notification_channel = sms | whatsapp ; notification_status = pending | sent | failed | cancelled
--   candidate_status     = new_lead | ... ; app_role = owner | staff | teacher | student | lead
-- =====================================================================
begin;

-- ---------- fixtures (auth.users trigger handle_new_user() creates profile + 'lead') ----------
insert into auth.users (id, email, aud, role) values
  ('00000000-0000-0000-0000-00000000000a','owner@test.invalid','authenticated','authenticated'),
  ('00000000-0000-0000-0000-00000000000b','staff@test.invalid','authenticated','authenticated'),
  ('00000000-0000-0000-0000-00000000000c','student1@test.invalid','authenticated','authenticated'),
  ('00000000-0000-0000-0000-00000000000d','student2@test.invalid','authenticated','authenticated'),
  ('00000000-0000-0000-0000-00000000000e','teacher@test.invalid','authenticated','authenticated');
insert into public.user_roles(user_id, role) values
  ('00000000-0000-0000-0000-00000000000a','owner'::public.app_role),
  ('00000000-0000-0000-0000-00000000000b','staff'::public.app_role),
  ('00000000-0000-0000-0000-00000000000c','student'::public.app_role),
  ('00000000-0000-0000-0000-00000000000d','student'::public.app_role),
  ('00000000-0000-0000-0000-00000000000e','teacher'::public.app_role)
on conflict do nothing;
insert into public.classes(id, name, teacher_id) values
  ('20000000-0000-0000-0000-000000000001','Test class A','00000000-0000-0000-0000-00000000000e'),
  ('20000000-0000-0000-0000-000000000002','Test class B',null);
insert into public.candidates(id, full_name, email, phone, notes, user_id, class_id, status) values
  ('10000000-0000-0000-0000-000000000001','T1','student1@test.invalid','0000000001','secret-note',
   '00000000-0000-0000-0000-00000000000c','20000000-0000-0000-0000-000000000001','new_lead'::public.candidate_status),
  ('10000000-0000-0000-0000-000000000002','T2','student2@test.invalid','0000000002',null,
   '00000000-0000-0000-0000-00000000000d','20000000-0000-0000-0000-000000000002','new_lead'::public.candidate_status);
insert into public.notifications(candidate_id, channel, to_phone, message, status) values
  ('10000000-0000-0000-0000-000000000002','sms'::public.notification_channel,'0000000000','t2',
   'pending'::public.notification_status),
  ('10000000-0000-0000-0000-000000000001','whatsapp'::public.notification_channel,'0000000000','t1',
   'pending'::public.notification_status);

-- ---------- A) anon: no privileges at all ----------
do $$
begin
  set local role anon;
  perform set_config('request.jwt.claims','{"role":"anon"}', true);
  begin
    perform count(*) from public.candidates;
    raise exception 'FAIL A1: anon could SELECT public.candidates';
  exception when insufficient_privilege then null;
  end;
  begin
    perform count(*) from public.notifications;
    raise exception 'FAIL A2: anon could SELECT public.notifications';
  exception when insufficient_privilege then null;
  end;
  begin
    perform * from public.get_teacher_roster();
    raise exception 'FAIL A3: anon could EXECUTE get_teacher_roster()';
  exception when insufficient_privilege then null;
  end;
  reset role;
  raise notice 'PASS A anon';
end $$;

-- ---------- B) student1: no candidates rows, only own notifications, no email hijack ----------
do $$
declare n int; b boolean;
begin
  set local role authenticated;
  perform set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-00000000000c","role":"authenticated"}', true);
  select count(*) into n from public.candidates;
  if n <> 0 then raise exception 'FAIL B1: student sees % candidates rows', n; end if;
  select count(*) into n from public.notifications where candidate_id = '10000000-0000-0000-0000-000000000002';
  if n <> 0 then raise exception 'FAIL B2: student sees other student notifications'; end if;
  select count(*) into n from public.notifications where candidate_id = '10000000-0000-0000-0000-000000000001';
  if n <> 1 then raise exception 'FAIL B3: student should see own notification, got %', n; end if;
  begin
    update public.profiles set email = 'student2@test.invalid' where id = '00000000-0000-0000-0000-00000000000c';
    raise exception 'FAIL B4: student could UPDATE profiles.email';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.candidates(full_name, status) values ('x','new_lead');
    raise exception 'FAIL B5: student could INSERT candidates';
  exception when insufficient_privilege then null;   -- 42501 new row violates RLS
  end;
  -- is_active self-reactivation blocked by WITH CHECK
  begin
    update public.profiles set is_active = false where id = '00000000-0000-0000-0000-00000000000c';
    raise exception 'FAIL B6: student could change own is_active';
  exception when insufficient_privilege then null;
  end;
  -- allowed columns still updatable
  update public.profiles set full_name = 'Student One', language = 'he' where id = '00000000-0000-0000-0000-00000000000c';
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'FAIL B7: student cannot update own full_name/language'; end if;
  select public.current_user_has_beqa_access() into b;
  if b then raise exception 'FAIL B8: beqa_access should be false by default'; end if;
  if public.current_candidate_id() is distinct from '10000000-0000-0000-0000-000000000001'::uuid then
    raise exception 'FAIL B9: current_candidate_id() wrong'; end if;
  if public.current_user_class_id() is distinct from '20000000-0000-0000-0000-000000000001'::uuid then
    raise exception 'FAIL B10: current_user_class_id() wrong'; end if;
  if public.is_staff() then raise exception 'FAIL B11: student is_staff() true'; end if;
  select count(*) into n from public.get_teacher_roster();
  if n <> 0 then raise exception 'FAIL B12: student gets roster rows'; end if;
  reset role;
  raise notice 'PASS B student';
end $$;

-- ---------- C) staff: reads all, cannot insert/delete candidates ----------
do $$
declare n int;
begin
  set local role authenticated;
  perform set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
  select count(*) into n from public.candidates
   where id in ('10000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000002');
  if n <> 2 then raise exception 'FAIL C1: staff should see 2 fixture candidates, got %', n; end if;
  delete from public.candidates where id = '10000000-0000-0000-0000-000000000001';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL C2: staff deleted a candidate'; end if;
  begin
    insert into public.candidates(full_name, status) values ('x','new_lead');
    raise exception 'FAIL C3: staff could INSERT candidates';
  exception when insufficient_privilege then null;
  end;
  reset role;
  raise notice 'PASS C staff';
end $$;

-- ---------- D) owner: full CRUD ----------
do $$
declare n int;
begin
  set local role authenticated;
  perform set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
  update public.candidates set notes = 'ok' where id = '10000000-0000-0000-0000-000000000001';
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'FAIL D1: owner update affected % rows', n; end if;
  -- owner can still toggle another user's is_active (admin.users.tsx)
  update public.profiles set is_active = false where id = '00000000-0000-0000-0000-00000000000d';
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'FAIL D2: owner cannot toggle is_active'; end if;
  reset role;
  raise notice 'PASS D owner';
end $$;

-- ---------- E) teacher: no table access, roster RPC returns only own class, no PII ----------
do $$
declare n int; cols text;
begin
  set local role authenticated;
  perform set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-00000000000e","role":"authenticated"}', true);
  select count(*) into n from public.candidates;
  if n <> 0 then raise exception 'FAIL E1: teacher sees % candidates rows via table', n; end if;
  select count(*) into n from public.get_teacher_roster();
  if n <> 1 then raise exception 'FAIL E2: teacher roster should have 1 row, got %', n; end if;
  if not exists (select 1 from public.get_teacher_roster() where id = '10000000-0000-0000-0000-000000000001') then
    raise exception 'FAIL E3: roster missing own-class student'; end if;
  reset role;
  select string_agg(a, ',' order by a) into cols
    from unnest((select proargnames from pg_proc where oid = 'public.get_teacher_roster()'::regprocedure)) a;
  if cols <> 'class_id,full_name,id,status' then raise exception 'FAIL E4: roster columns = %', cols; end if;
  raise notice 'PASS E teacher';
end $$;

-- ---------- F) catalog checks ----------
do $$
declare n int;
begin
  select count(*) into n from pg_class
   where oid in ('public.candidates'::regclass,'public.candidate_documents'::regclass,
                 'public.notifications'::regclass,'public.schedule_events'::regclass)
     and relrowsecurity and relforcerowsecurity and not has_table_privilege('anon', oid, 'SELECT');
  if n <> 4 then raise exception 'FAIL F1: RLS/FORCE/anon-revoke missing on % of 4 tables', 4 - n; end if;
  -- CTO decision: no policy on ANY table may match on email.
  select count(*) into n from pg_policies
   where schemaname in ('public','storage')
     and (qual ilike '%email%' or with_check ilike '%email%');
  if n <> 0 then raise exception 'FAIL F2: % policies still reference email', n; end if;
  select count(*) into n from pg_policies
   where schemaname = 'public' and tablename = 'schedule_events'
     and policyname in ('Teachers insert their schedule','Teachers view their schedule','Teachers update their schedule');
  if n <> 3 then raise exception 'FAIL F3: teacher schedule policies not kept (%/3)', n; end if;
  raise notice 'PASS F catalog';
end $$;

-- ---------- G) attendance / makeup / contact_messages via stable link ----------
insert into public.attendance_records(class_id, candidate_id, lesson_date, mark) values
  ('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001', current_date, 'present'::public.attendance_mark),
  ('20000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000002', current_date, 'late'::public.attendance_mark);
insert into public.makeup_assignments(candidate_id, source_class_id, source_date) values
  ('10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001', current_date),
  ('10000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000002', current_date);
insert into public.contact_messages(sender_id, recipient_role, subject, content) values
  ('00000000-0000-0000-0000-00000000000c','teacher'::public.contact_recipient,'s1','t'),
  ('00000000-0000-0000-0000-00000000000d','teacher'::public.contact_recipient,'s2','t');
do $$
declare n int;
begin
  set local role authenticated;
  perform set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-00000000000c","role":"authenticated"}', true);
  select count(*) into n from public.attendance_records;
  if n <> 1 then raise exception 'FAIL G1: student1 should see 1 own attendance row, got %', n; end if;
  select count(*) into n from public.makeup_assignments;
  if n <> 1 then raise exception 'FAIL G2: student1 should see 1 own makeup row, got %', n; end if;
  select count(*) into n from public.contact_messages;
  if n <> 1 then raise exception 'FAIL G3: student1 should see only own message, got %', n; end if;
  reset role;
  -- teacher of class A (student1) sees student1's teacher message only
  set local role authenticated;
  perform set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-00000000000e","role":"authenticated"}', true);
  select count(*) into n from public.contact_messages;
  if n <> 1 then raise exception 'FAIL G4: teacher should see 1 message, got %', n; end if;
  update public.contact_messages set is_read = true where subject = 's2';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL G5: teacher updated a message from another class'; end if;
  reset role;
  raise notice 'PASS G attendance/makeup/contact';
end $$;


-- H: explicit grants (Supabase 2026-10-30 behaviour; replay revokes default privileges first)
do $$
declare t text; f text;
begin
  foreach t in array array['public.candidates','public.candidate_documents','public.notifications','public.schedule_events'] loop
    if has_table_privilege('anon', t, 'SELECT') or has_table_privilege('anon', t, 'INSERT') then
      raise exception 'FAIL H1: anon has access to %', t; end if;
    if not (has_table_privilege('authenticated', t, 'SELECT') and has_table_privilege('authenticated', t, 'INSERT')
            and has_table_privilege('authenticated', t, 'UPDATE') and has_table_privilege('authenticated', t, 'DELETE')) then
      raise exception 'FAIL H2: authenticated missing DML on %', t; end if;
    if not (has_table_privilege('service_role', t, 'SELECT') and has_table_privilege('service_role', t, 'INSERT')
            and has_table_privilege('service_role', t, 'UPDATE') and has_table_privilege('service_role', t, 'DELETE')) then
      raise exception 'FAIL H3: service_role missing DML on %', t; end if;
    if has_table_privilege('service_role', t, 'TRUNCATE') or has_table_privilege('authenticated', t, 'TRUNCATE') then
      raise exception 'FAIL H4: TRUNCATE granted on %', t; end if;
  end loop;
  foreach f in array array['public.is_staff(boolean)','public.current_candidate_id()','public.current_user_class_id()',
                           'public.current_user_has_beqa_access()','public.get_teacher_roster()','public.teaches_student_user(uuid)'] loop
    if has_function_privilege('anon', f, 'EXECUTE') then raise exception 'FAIL H5: anon can execute %', f; end if;
    if not has_function_privilege('authenticated', f, 'EXECUTE') then raise exception 'FAIL H6: authenticated cannot execute %', f; end if;
  end loop;
  if has_function_privilege('service_role', 'public.get_teacher_roster()', 'EXECUTE') then
    raise exception 'FAIL H7: service_role does not need get_teacher_roster'; end if;
  if not has_column_privilege('authenticated', 'public.profiles', 'full_name', 'UPDATE')
     or has_column_privilege('authenticated', 'public.profiles', 'email', 'UPDATE') then
    raise exception 'FAIL H8: profiles column grants wrong'; end if;
  raise notice 'PASS H explicit grants';
end $$;


-- I: review fixes (2026-11-01)
do $$
declare n int; owner uuid := '00000000-0000-0000-0000-00000000000a';
        staff uuid := '00000000-0000-0000-0000-00000000000b';
        stu uuid := '00000000-0000-0000-0000-00000000000c';
        tch uuid := '00000000-0000-0000-0000-00000000000e';
begin
  -- I1/I1b skipped when fix/beta-no-id-medical-docs has dropped the upload policy
  if exists (select 1 from pg_policy where polrelid = 'public.candidate_documents'::regclass
               and polname = 'cand_docs_staff_insert') then
    -- I1: staff upload works without sending uploaded_by (default auth.uid())
    set local role authenticated;
    perform set_config('request.jwt.claims', json_build_object('sub',staff,'role','authenticated')::text, true);
    insert into public.candidate_documents(candidate_id, label, file_path)
      values ('10000000-0000-0000-0000-000000000001','I1','10000000-0000-0000-0000-000000000001/i1.pdf');
    reset role;
    if (select uploaded_by from public.candidate_documents where label='I1') <> staff then raise exception 'FAIL I1 uploaded_by default'; end if;
    -- I1b: spoofed uploaded_by still rejected
    set local role authenticated;
    perform set_config('request.jwt.claims', json_build_object('sub',staff,'role','authenticated')::text, true);
    begin
      insert into public.candidate_documents(candidate_id, label, file_path, uploaded_by)
        values ('10000000-0000-0000-0000-000000000001','I1b','x/i1b.pdf', owner);
      raise exception 'FAIL I1b spoofed uploaded_by accepted';
    exception when insufficient_privilege then null; end;
    reset role;
  else
    raise notice 'SKIP I1 (document upload disabled in beta)';
  end if;

  -- I2: roster requires teacher role; includes assigned_teacher_id (only for
  -- candidates without a class, section 12)
  update public.candidates set class_id = null, assigned_teacher_id = tch where id = '10000000-0000-0000-0000-000000000002';
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub',tch,'role','authenticated')::text, true);
  select count(*) into n from public.get_teacher_roster();
  if n <> 2 then raise exception 'FAIL I2a teacher roster=% (class + assigned)', n; end if;
  perform set_config('request.jwt.claims', json_build_object('sub',owner,'role','authenticated')::text, true);
  select count(*) into n from public.get_teacher_roster();
  if n <> 0 then raise exception 'FAIL I2b non-teacher got roster'; end if;
  reset role;
  delete from public.user_roles where user_id = tch and role = 'teacher';
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub',tch,'role','authenticated')::text, true);
  select count(*) into n from public.get_teacher_roster();
  if n <> 0 then raise exception 'FAIL I2c teacher_id without teacher role got roster'; end if;
  reset role;
  insert into public.user_roles(user_id, role) values (tch, 'teacher');

  -- I3: has_role cannot probe others unless staff
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub',stu,'role','authenticated')::text, true);
  if public.has_role(owner, 'owner') then raise exception 'FAIL I3a student probed owner role'; end if;
  if not public.has_role(stu, 'student') then raise exception 'FAIL I3b own role'; end if;
  if not public.is_teacher_user(tch) then raise exception 'FAIL I3c teacher lookup'; end if;
  perform set_config('request.jwt.claims', json_build_object('sub',staff,'role','authenticated')::text, true);
  if not public.has_role(owner, 'owner') then raise exception 'FAIL I3d staff lookup'; end if;
  reset role;
  if (select prosecdef from pg_proc where oid='public.has_role(uuid,public.app_role)'::regprocedure) is not true
     or not exists (select 1 from pg_proc where oid='public.has_role(uuid,public.app_role)'::regprocedure and proconfig @> array['search_path=""']) then
    raise exception 'FAIL I3e has_role definer/search_path'; end if;

  -- I4: teacher update WITH CHECK (cannot move attendance to another class)
  if not exists (select 1 from pg_policy where polname='Teachers update their class attendance' and polwithcheck is not null)
     or not exists (select 1 from pg_policy where polname='Teachers update their schedule' and polwithcheck is not null) then
    raise exception 'FAIL I4 WITH CHECK missing'; end if;

  -- I5: rewritten teacher policies on exam_results / raw_biometric_log
  if exists (select 1 from pg_policy where polname in ('Teachers view their candidates results','Teachers view their students bio log')) then
    raise exception 'FAIL I5a dead policies remain'; end if;
  if (select count(*) from pg_policy where polname in ('exam_results_teacher_select','raw_bio_teacher_select')) <> 2 then
    raise exception 'FAIL I5b new teacher policies missing'; end if;

  -- I6: default privileges no longer give PUBLIC/anon EXECUTE on new functions
  create function public._i6_probe() returns int language sql as 'select 1';
  if has_function_privilege('anon','public._i6_probe()','EXECUTE') then raise exception 'FAIL I6 default EXECUTE'; end if;
  drop function public._i6_probe();
  -- I7: exact auth lookup is service_role only
  if has_function_privilege('authenticated','public.admin_find_auth_user(text)','EXECUTE')
     or has_function_privilege('anon','public.admin_find_auth_user(text)','EXECUTE')
     or not has_function_privilege('service_role','public.admin_find_auth_user(text)','EXECUTE') then
    raise exception 'FAIL I7a admin_find_auth_user grants'; end if;
  if (select id from public.admin_find_auth_user(' STUDENT1@test.invalid ')) <> stu then raise exception 'FAIL I7b exact lookup'; end if;
  raise notice 'PASS I review fixes';
end $$;

-- J: security re-review - teacher reassignment (former teacher loses access)
do $$
declare n int; t_old uuid := '00000000-0000-0000-0000-00000000000e';
        t_new uuid := '00000000-0000-0000-0000-0000000000f1';
        stu uuid := '00000000-0000-0000-0000-00000000000c';
begin
  insert into auth.users (id, email, aud, role) values (t_new, 'teacher2@test.invalid', 'authenticated', 'authenticated');
  insert into public.user_roles(user_id, role) values (t_new, 'teacher') on conflict do nothing;
  -- T1 is in class A (teacher t_old) and carries assigned_teacher_id = t_old
  if (select assigned_teacher_id from public.candidates where id = '10000000-0000-0000-0000-000000000001') <> t_old then
    raise exception 'FAIL J0 fixture'; end if;
  update public.classes set teacher_id = t_new where id = '20000000-0000-0000-0000-000000000001';
  if (select assigned_teacher_id from public.candidates where id = '10000000-0000-0000-0000-000000000001') <> t_new then
    raise exception 'FAIL J1 assigned_teacher_id not re-synced'; end if;
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', t_old, 'role', 'authenticated')::text, true);
  select count(*) into n from public.get_teacher_roster() r where r.id = '10000000-0000-0000-0000-000000000001';
  if n <> 0 then raise exception 'FAIL J2 former teacher still sees the student'; end if;
  if public.teaches_student_user(stu) then raise exception 'FAIL J3 former teacher teaches_student_user'; end if;
  perform set_config('request.jwt.claims', json_build_object('sub', t_new, 'role', 'authenticated')::text, true);
  if not public.teaches_student_user(stu) then raise exception 'FAIL J4 new teacher has no access'; end if;
  reset role;
  -- J5: stale assigned_teacher_id (written directly) is ignored while the candidate has a class
  alter table public.candidates disable trigger trg_candidates_sync_teacher;
  update public.candidates set assigned_teacher_id = t_old where id = '10000000-0000-0000-0000-000000000001';
  alter table public.candidates enable trigger trg_candidates_sync_teacher;
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', t_old, 'role', 'authenticated')::text, true);
  if public.teaches_student_user(stu) then raise exception 'FAIL J5 stale assigned_teacher_id honoured'; end if;
  reset role;
  -- J6: teacher UPDATE policies require the teacher role
  if (select count(*) from pg_policy where polname in ('Teachers update their schedule', 'Teachers update their class attendance')
        and pg_get_expr(polqual, polrelid) like '%teacher%app_role%'
        and pg_get_expr(polwithcheck, polrelid) like '%teacher%app_role%') <> 2 then
    raise exception 'FAIL J6 teacher role check missing'; end if;
  -- J8: teacher INSERT policies require the teacher role (round 3)
  if (select count(*) from pg_policy where polname in ('Teachers insert their schedule', 'Teachers insert their class attendance')
        and pg_get_expr(polwithcheck, polrelid) like '%teacher%app_role%') <> 2 then
    raise exception 'FAIL J8 teacher role check missing on INSERT'; end if;
  -- J9: the class teacher inserts attendance; without the teacher role it cannot
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', t_new, 'role', 'authenticated')::text, true);
  insert into public.attendance_records(class_id, candidate_id, lesson_date, mark)
    values ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', current_date + 400, 'present');
  reset role;
  delete from public.user_roles where user_id = t_new and role = 'teacher';
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', t_new, 'role', 'authenticated')::text, true);
  begin
    insert into public.attendance_records(class_id, candidate_id, lesson_date, mark)
      values ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', current_date + 401, 'present');
    raise exception 'FAIL J9 insert without teacher role';
  exception when insufficient_privilege then null;
  end;
  reset role;
  if has_function_privilege('authenticated', 'public.classes_sync_candidate_teacher()', 'EXECUTE') then
    raise exception 'FAIL J7 sync function executable'; end if;
  raise notice 'PASS J teacher reassignment';
end $$;

rollback;
