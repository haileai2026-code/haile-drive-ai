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
  select count(*) into n from pg_policies
   where schemaname = 'public'
     and tablename in ('candidates','candidate_documents','notifications','schedule_events','profiles')
     and (qual ilike '%email%' or with_check ilike '%email%');
  if n <> 0 then raise exception 'FAIL F2: % in-scope policies still reference email', n; end if;
  select count(*) into n from pg_policies
   where schemaname = 'public' and tablename = 'schedule_events'
     and policyname in ('Teachers insert their schedule','Teachers view their schedule','Teachers update their schedule');
  if n <> 3 then raise exception 'FAIL F3: teacher schedule policies not kept (%/3)', n; end if;
  raise notice 'PASS F catalog';
end $$;

rollback;
