-- Local test for 20261101130000_beta_block_psych_and_docs.sql (rolled back).
begin;
do $$
declare ok boolean; uid uuid := '00000000-0000-0000-0000-0000000be7a1'; sid uuid;
begin
  insert into auth.users(id, email) values (uid, 'beta@test.invalid');

  -- P1: psych writes blocked for every role while the flag is off
  ok := false;
  begin
    insert into public.beqa_diagnostic_sessions(student_id, assessment_type) values (uid, 'psychological');
  exception when insufficient_privilege then ok := true; end;
  if not ok then raise exception 'FAIL P1 postgres insert not blocked'; end if;
  ok := false;
  begin
    execute 'set local role service_role';
    insert into public.beqa_pulse_clicks(session_id, student_id) values (gen_random_uuid(), uid);
  exception when insufficient_privilege then ok := true; end;
  execute 'reset role';
  if not ok then raise exception 'FAIL P2 service_role insert not blocked'; end if;

  -- P3: enabled -> allowed
  perform set_config('app.beta_psych_assessments', 'on', true);
  insert into public.beqa_diagnostic_sessions(student_id, assessment_type) values (uid, 'psychological') returning id into sid;
  insert into public.raw_biometric_log(session_id, student_id, event_type) values (sid, uid, 'test');
  perform set_config('app.beta_psych_assessments', 'off', true);

  -- D1: no INSERT policy for candidate documents (table + bucket)
  if exists (select 1 from pg_policy where polrelid = 'public.candidate_documents'::regclass and polcmd in ('a', '*')) then
    raise exception 'FAIL D1 candidate_documents insert policy remains'; end if;
  if exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects'
               and cmd in ('INSERT', 'ALL') and coalesce(with_check, '') like '%candidate-documents%') then
    raise exception 'FAIL D2 storage insert policy for candidate-documents remains'; end if;
  if has_function_privilege('authenticated', 'public.beta_psych_write_guard()', 'EXECUTE') then
    raise exception 'FAIL G1 guard executable'; end if;
  raise notice 'PASS beta_block_psych_and_docs';
end $$;
rollback;
