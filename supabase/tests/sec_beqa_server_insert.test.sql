-- fix/sec-beqa-server-insert: students cannot write BEQA sessions.
-- Run ONLY against a local / branch DB as postgres; rolled back at the end.
-- Synthetic ids only.
begin;
insert into auth.users (id, email, aud, role) values
  ('00000000-0000-0000-0000-0000000000c1','stu@test.invalid','authenticated','authenticated'),
  ('00000000-0000-0000-0000-0000000000a1','own@test.invalid','authenticated','authenticated');
insert into public.user_roles(user_id, role) values
  ('00000000-0000-0000-0000-0000000000c1','student'::public.app_role),
  ('00000000-0000-0000-0000-0000000000a1','owner'::public.app_role) on conflict do nothing;
-- a session written by the service path (postgres here = BYPASSRLS like service_role)
insert into public.beqa_diagnostic_sessions(id, student_id, final_beqa_score)
  values ('30000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000000c1', 50);

do $$
declare n int;
begin
  set local role authenticated;
  perform set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated"}', true);
  begin
    insert into public.beqa_diagnostic_sessions(student_id, final_beqa_score)
      values ('00000000-0000-0000-0000-0000000000c1', 99);
    raise exception 'FAIL 1: student could INSERT a BEQA session';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.beqa_diagnostic_sessions set final_beqa_score = 99
      where id = '30000000-0000-0000-0000-000000000001';
    raise exception 'FAIL 2: student could UPDATE a BEQA session';
  exception when insufficient_privilege then null;
  end;
  select count(*) into n from public.beqa_diagnostic_sessions;
  if n <> 0 then raise exception 'FAIL 3: student can read % BEQA rows', n; end if;
  reset role;

  set local role anon;
  perform set_config('request.jwt.claims','{"role":"anon"}', true);
  begin
    perform count(*) from public.beqa_diagnostic_sessions;
    raise exception 'FAIL 4: anon could SELECT BEQA sessions';
  exception when insufficient_privilege then null;
  end;
  reset role;

  set local role authenticated;
  perform set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
  select count(*) into n from public.beqa_diagnostic_sessions where id = '30000000-0000-0000-0000-000000000001';
  if n <> 1 then raise exception 'FAIL 5: owner cannot read BEQA session'; end if;
  reset role;
  raise notice 'PASS sec_beqa_server_insert';
end $$;

-- G: explicit grants (Supabase 2026-10-30 behaviour)
do $$
declare t text := 'public.beqa_diagnostic_sessions';
begin
  if has_table_privilege('anon', t, 'SELECT') or has_table_privilege('anon', t, 'INSERT') then raise exception 'FAIL G1 anon'; end if;
  if has_table_privilege('authenticated', t, 'INSERT') or has_table_privilege('authenticated', t, 'UPDATE')
     or has_table_privilege('authenticated', t, 'TRUNCATE') then raise exception 'FAIL G2 authenticated can write'; end if;
  if not (has_table_privilege('authenticated', t, 'SELECT') and has_table_privilege('authenticated', t, 'DELETE')) then
    raise exception 'FAIL G3 authenticated lost select/delete'; end if;
  if not (has_table_privilege('service_role', t, 'INSERT') and has_table_privilege('service_role', t, 'SELECT')) then
    raise exception 'FAIL G4 service_role cannot insert/select'; end if;
  if has_table_privilege('service_role', t, 'TRUNCATE') then raise exception 'FAIL G5 service_role truncate'; end if;
  raise notice 'PASS G explicit grants';
end $$;

rollback;
