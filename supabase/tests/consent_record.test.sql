-- feat/consent-record: append-only consents, server-only writes, retention.
-- Run ONLY against a local / branch DB as postgres; rolled back at the end.
-- Synthetic users only (requires public.candidates from fix/sec-candidates-rls).
begin;

do $$
declare
  u1 uuid := '00000000-0000-0000-0000-0000000c0501';
  u2 uuid := '00000000-0000-0000-0000-0000000c0502';
  st uuid := '00000000-0000-0000-0000-0000000c0503';
  cand uuid := '00000000-0000-0000-0000-0000000c0599';
  web jsonb := '{"ip_hash":"00ff","user_agent":"test-agent"}';
  n int; ok boolean; rid uuid; rid2 uuid; ts timestamptz; p1 uuid; p2 uuid;
begin
  insert into auth.users(id, email) values (u1, 'c1@test.local'), (u2, 'c2@test.local'), (st, 'st@test.local');
  insert into public.user_roles(user_id, role) values (st, 'staff');
  insert into public.candidates(id, full_name, email) values (cand, 'WA subject', 'wa@test.local');

  -- K1: client roles have no write privilege at all
  if has_table_privilege('authenticated', 'public.consents', 'INSERT')
     or has_table_privilege('authenticated', 'public.consents', 'UPDATE')
     or has_table_privilege('authenticated', 'public.consents', 'DELETE')
     or has_table_privilege('anon', 'public.consents', 'SELECT') then
    raise exception 'FAIL K1: forbidden privilege present'; end if;
  select count(*) into n from pg_policies
   where schemaname = 'public' and tablename = 'consents' and cmd in ('INSERT', 'UPDATE', 'DELETE', 'ALL');
  if n <> 0 then raise exception 'FAIL K1b: write policy exists'; end if;

  -- K2: server path (service_role) records with server time + evidence
  execute 'set local role service_role';
  rid := public.record_consent(u1, null, 'privacy_terms_abroad', true, 'campus-privacy-v0.4',
           'campus-terms-beta-v0.4', 'campus-consent-v0.3-he', 'he', 'web', web);
  select created_at, subject_pseudonym into ts, p1 from public.consents where id = rid;
  if ts < now() - interval '1 minute' then raise exception 'FAIL K2: server time'; end if;
  if not public.consent_ok(u1) then raise exception 'FAIL K2b consent_ok'; end if;
  if public.consent_ok(u2) then raise exception 'FAIL K2c consent_ok for user without consent'; end if;

  -- K3: allowed-versions check
  ok := false;
  begin
    perform public.record_consent(u1, null, 'privacy_terms_abroad', true, 'campus-privacy-v0.1',
              'campus-terms-beta-v0.4', 'campus-consent-v0.3-he', 'he', 'web', web);
  exception when invalid_parameter_value then ok := true; end;
  if not ok then raise exception 'FAIL K3: old notice version accepted'; end if;

  -- K4: evidence required per channel
  ok := false;
  begin
    perform public.record_consent(u1, null, 'partner_individual_progress', true, 'campus-privacy-v0.4',
              null, 'campus-consent-partner-v0.3-he', 'he', 'web', '{"user_agent":"x"}');
  exception when check_violation then ok := true; end;
  if not ok then raise exception 'FAIL K4: web without ip_hash accepted'; end if;
  ok := false;
  begin
    perform public.record_consent(null, cand, 'partner_individual_progress', true, 'campus-privacy-v0.4',
              null, 'campus-consent-partner-v0.3-he', 'he', 'whatsapp', '{"message_id":"wamid.test"}');
  exception when check_violation then ok := true; end;
  if not ok then raise exception 'FAIL K4b: whatsapp without template accepted'; end if;

  -- K5: whatsapp consent for a candidate without account; subject required
  rid2 := public.record_consent(null, cand, 'partner_individual_progress', true, 'campus-privacy-v0.4',
            null, 'campus-consent-partner-v0.3-he', 'he', 'whatsapp', '{"message_id":"wamid.test","template":"consent_v1"}');
  ok := false;
  begin
    perform public.record_consent(null, null, 'partner_individual_progress', true, 'campus-privacy-v0.4',
              null, 'campus-consent-partner-v0.3-he', 'he', 'web', web);
  exception when raise_exception or check_violation then ok := true; end;
  if not ok then raise exception 'FAIL K5: subject-less row accepted'; end if;

  -- K6: withdrawal row, same pseudonym, consent_ok false afterwards
  perform public.record_consent(u1, null, 'privacy_terms_abroad', false, 'campus-privacy-v0.4',
            'campus-terms-beta-v0.4', 'campus-consent-v0.3-he', 'he', 'web', web);
  if public.consent_ok(u1) then raise exception 'FAIL K6 withdrawal ignored'; end if;
  select count(distinct subject_pseudonym) into n from public.consents where user_id = u1;
  if n <> 1 then raise exception 'FAIL K6b pseudonym not stable'; end if;

  -- K7: DELETE blocked for service_role without app.erasure
  ok := false;
  begin delete from public.consents where id = rid; exception when raise_exception then ok := true; end;
  if not ok then raise exception 'FAIL K7 delete without erasure flag'; end if;
  execute 'reset role';

  -- K8: postgres too: no UPDATE, no DELETE, no TRUNCATE
  ok := false;
  begin update public.consents set granted = false where id = rid; exception when raise_exception then ok := true; end;
  if not ok then raise exception 'FAIL K8a update not blocked'; end if;
  ok := false;
  begin perform set_config('app.erasure','on',true); delete from public.consents where id = rid;
  exception when raise_exception then ok := true; end;
  perform set_config('app.erasure','off',true);
  if not ok then raise exception 'FAIL K8b delete by non-service_role allowed'; end if;
  ok := false;
  begin truncate public.consents; exception when raise_exception then ok := true; end;
  if not ok then raise exception 'FAIL K8c truncate not blocked'; end if;

  -- K9: own / staff visibility; no client insert
  perform set_config('request.jwt.claims', json_build_object('sub', u2, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  select count(*) into n from public.consents;
  if n <> 0 then raise exception 'FAIL K9 other user sees consents'; end if;
  ok := false;
  begin
    insert into public.consents(user_id, consent_type, granted, notice_version, terms_version, checkbox_version, language, evidence)
      values (u2, 'privacy_terms_abroad', true, 'campus-privacy-v0.4', 'campus-terms-beta-v0.4', 'campus-consent-v0.3-he', 'he', web);
  exception when insufficient_privilege then ok := true; end;
  if not ok then raise exception 'FAIL K9b client insert allowed'; end if;
  execute 'reset role';
  perform set_config('request.jwt.claims', json_build_object('sub', st, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  select count(*) into n from public.consents;
  execute 'reset role';
  if n <> 3 then raise exception 'FAIL K9c staff sees % rows', n; end if;

  -- K10: erasure = ON DELETE SET NULL; rows kept with pseudonym + erased_at
  delete from auth.users where id = u1;
  select count(*) into n from public.consents where subject_pseudonym = p1 and user_id is null and subject_erased_at is not null;
  if n <> 2 then raise exception 'FAIL K10 erasure kept % rows', n; end if;
  delete from public.candidates where id = cand;
  select subject_pseudonym into p2 from public.consents where id = rid2;
  if (select subject_erased_at from public.consents where id = rid2) is null then raise exception 'FAIL K10b candidate erasure'; end if;

  -- K11: retention purge: life + 3 years
  execute 'set local role service_role';
  n := public.purge_expired_consents();
  if n <> 0 then raise exception 'FAIL K11a purged % fresh rows', n; end if;
  execute 'reset role';
  alter table public.consents disable trigger consents_guard;   -- test-only backdating
  update public.consents set subject_erased_at = now() - interval '3 years 1 day' where id = rid2;
  update public.consents set created_at = now() - interval '5 years' where id = rid;
  update public.consents set created_at = now() - interval '3 years 2 days' where subject_pseudonym = p1 and id <> rid;
  alter table public.consents enable trigger consents_guard;
  execute 'set local role service_role';
  n := public.purge_expired_consents();
  execute 'reset role';
  -- rid2: erased > 3y ago -> purged; rid: superseded > 3y ago -> purged; withdrawal row: erased just now -> kept
  if n <> 2 or (select count(*) from public.consents where subject_pseudonym in (p1, p2)) <> 1 then
    raise exception 'FAIL K11b purge removed % rows', n; end if;

  raise notice 'PASS consent_record';
end $$;

-- G: explicit grants (Supabase 2026-10-30 behaviour)
do $$
declare f text;
begin
  if not has_table_privilege('authenticated','public.consents','SELECT')
     or has_table_privilege('authenticated','public.consents','INSERT') then raise exception 'FAIL G1 authenticated'; end if;
  if has_table_privilege('authenticated','public.consents','TRUNCATE')
     or has_table_privilege('service_role','public.consents','TRUNCATE')
     or has_table_privilege('service_role','public.consents','UPDATE') then raise exception 'FAIL G2 truncate/update'; end if;
  if not (has_table_privilege('service_role','public.consents','SELECT') and has_table_privilege('service_role','public.consents','INSERT')
          and has_table_privilege('service_role','public.consents','DELETE')) then raise exception 'FAIL G3 service_role'; end if;
  -- consent_ok is used by RLS: authenticated + service_role (R9c)
  if has_function_privilege('anon','public.consent_ok(uuid)','EXECUTE')
     or not has_function_privilege('authenticated','public.consent_ok(uuid)','EXECUTE')
     or not has_function_privilege('service_role','public.consent_ok(uuid)','EXECUTE') then raise exception 'FAIL G4b consent_ok grants'; end if;
  if (select not prosecdef or provolatile <> 's' or not (proconfig @> array['search_path=""'])
        from pg_proc where oid = 'public.consent_ok(uuid)'::regprocedure) then raise exception 'FAIL G4c consent_ok definer/stable/search_path'; end if;
  if has_function_privilege('authenticated','public.exam_results_consent_guard()','EXECUTE') then raise exception 'FAIL G4d trigger fn'; end if;
  foreach f in array array['public.record_consent(uuid,uuid,text,boolean,text,text,text,text,text,jsonb)',
                           'public.purge_expired_consents()','public.consent_version_allowed(text,text,text,text)'] loop
    if has_function_privilege('anon', f, 'EXECUTE') or has_function_privilege('authenticated', f, 'EXECUTE') then
      raise exception 'FAIL G4 client can execute %', f; end if;
    if not has_function_privilege('service_role', f, 'EXECUTE') then raise exception 'FAIL G5 service_role %', f; end if;
  end loop;
  if has_function_privilege('authenticated','public.consents_guard()','EXECUTE')
     or has_function_privilege('service_role','public.consents_guard()','EXECUTE') then raise exception 'FAIL G6 consents_guard'; end if;
  if (select count(*) from cron.job where jobname = 'consents-retention-purge') <> 1 then raise exception 'FAIL G7 purge cron'; end if;
  raise notice 'PASS G explicit grants';
end $$;

-- C: student writes require the CURRENT consent (RLS, R9d); staff unchanged.
do $$
declare
  s1 uuid := '00000000-0000-0000-0000-0000000c0601';
  sf uuid := '00000000-0000-0000-0000-0000000c0602';
  cls uuid := '00000000-0000-0000-0000-0000000c06c1';
  post uuid;
  web jsonb := '{"ip_hash":"00ff","user_agent":"t"}';
  ok boolean;
  procedure_name text;
  res jsonb := '{}';
begin
  insert into auth.users(id, email) values (s1, 'cs1@test.local'), (sf, 'csf@test.local');
  insert into public.user_roles(user_id, role) values (s1, 'student'), (sf, 'staff') on conflict do nothing;
  insert into public.classes(id, name) values (cls, 'C class');
  insert into public.candidates(id, full_name, email, user_id, class_id)
    values ('00000000-0000-0000-0000-0000000c06a1', 'CS1', 'cs1@test.local', s1, cls);
  insert into public.community_posts(id, author_id, content, post_type, class_id)
    values (gen_random_uuid(), sf, 'staff post', 'post', cls) returning id into post;


  for procedure_name in select unnest(array['none', 'old', 'current']) loop
    if procedure_name = 'old' then
      alter table public.consents disable trigger consents_guard;
      insert into public.consents(user_id, consent_type, granted, notice_version, terms_version, checkbox_version, language, channel, evidence)
        values (s1, 'privacy_terms_abroad', true, 'campus-privacy-v0.3', 'campus-terms-beta-v0.3', 'campus-consent-v0.2-he', 'he', 'web', web);
      alter table public.consents enable trigger consents_guard;
    elsif procedure_name = 'current' then
      execute 'set local role service_role';
      perform public.record_consent(s1, null, 'privacy_terms_abroad', true, 'campus-privacy-v0.4', 'campus-terms-beta-v0.4',
                                    'campus-consent-v0.3-he', 'he', 'web', web);
      execute 'reset role';
    end if;
    perform set_config('request.jwt.claims', json_build_object('sub', s1, 'role', 'authenticated')::text, true);
    execute 'set local role authenticated';
    begin insert into public.community_posts(author_id, content, post_type, class_id) values (s1, 'p', 'post', cls); ok := true;
    exception when insufficient_privilege then ok := false; end;
    res := res || jsonb_build_object(procedure_name || ':post', ok);
    begin insert into public.community_comments(post_id, author_id, content) values (post, s1, 'c'); ok := true;
    exception when insufficient_privilege then ok := false; end;
    res := res || jsonb_build_object(procedure_name || ':comment', ok);
    begin insert into public.feedback_reports(author_id, type, title, content) values (s1, 'bug', 't', 'c'); ok := true;
    exception when insufficient_privilege then ok := false; end;
    res := res || jsonb_build_object(procedure_name || ':feedback', ok);
    begin insert into public.contact_messages(sender_id, recipient_role, subject, content) values (s1, 'secretary', 's', 'c'); ok := true;
    exception when insufficient_privilege then ok := false; end;
    res := res || jsonb_build_object(procedure_name || ':contact', ok);
    begin insert into storage.objects(bucket_id, name, owner) values ('community-media', s1::text || '/' || procedure_name || '.jpg', s1); ok := true;
    exception when insufficient_privilege then ok := false; end;
    res := res || jsonb_build_object(procedure_name || ':upload', ok);
    execute 'reset role';
    -- exam results are written by the SECURITY DEFINER RPC: trigger guard
    begin insert into public.exam_results(user_id, exam_title, score) values (s1, procedure_name, 1); ok := true;
    exception when insufficient_privilege then ok := false; end;
    res := res || jsonb_build_object(procedure_name || ':exam', ok);
  end loop;

  if exists (select 1 from jsonb_each_text(res) e(name, v) where name like 'none:%' and v::boolean) then
    raise exception 'FAIL C1 write without consent: %', (select string_agg(name, ',') from jsonb_each_text(res) e(name, v) where name like 'none:%' and v::boolean); end if;
  if exists (select 1 from jsonb_each_text(res) e(name, v) where name like 'old:%' and v::boolean) then
    raise exception 'FAIL C2 write with an OLD consent version: %', (select string_agg(name, ',') from jsonb_each_text(res) e(name, v) where name like 'old:%' and v::boolean); end if;
  if exists (select 1 from jsonb_each_text(res) e(name, v) where name like 'current:%' and not v::boolean) then
    raise exception 'FAIL C3 write denied with current consent: %', (select string_agg(name, ',') from jsonb_each_text(res) e(name, v) where name like 'current:%' and not v::boolean); end if;

  -- C4: post update needs consent too (withdraw -> denied)
  execute 'set local role service_role';
  perform public.record_consent(s1, null, 'privacy_terms_abroad', false, 'campus-privacy-v0.4', 'campus-terms-beta-v0.4',
                                'campus-consent-v0.3-he', 'he', 'web', web);
  execute 'reset role';
  perform set_config('request.jwt.claims', json_build_object('sub', s1, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  update public.community_posts set content = 'edited' where author_id = s1;
  execute 'reset role';
  if exists (select 1 from public.community_posts where author_id = s1 and content = 'edited') then
    raise exception 'FAIL C4 update after withdrawal'; end if;

  -- C5: staff (no consent row) unchanged
  perform set_config('request.jwt.claims', json_build_object('sub', sf, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  insert into public.community_posts(author_id, content, post_type, class_id) values (sf, 'staff 2', 'announcement', cls);
  insert into public.community_comments(post_id, author_id, content) values (post, sf, 'staff c');
  execute 'reset role';

  -- C6: a student cannot probe someone else's consent; staff can
  perform set_config('request.jwt.claims', json_build_object('sub', sf, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  ok := public.consent_ok(s1);  -- withdrawn -> false, but answered
  execute 'reset role';
  perform set_config('request.jwt.claims', json_build_object('sub', s1, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  if public.consent_ok(sf) then raise exception 'FAIL C6 probe'; end if;
  execute 'reset role';

  -- C7: guard rejects an unknown version even on a direct service_role insert
  execute 'set local role service_role';
  begin
    insert into public.consents(user_id, consent_type, granted, notice_version, terms_version, checkbox_version, language, channel, evidence)
      values (s1, 'privacy_terms_abroad', true, 'campus-privacy-v9', 'campus-terms-beta-v0.4', 'campus-consent-v0.3-he', 'he', 'web', web);
    raise exception 'FAIL C7 unknown version inserted';
  exception when invalid_parameter_value then null; end;
  -- C8: new channels need their evidence
  perform public.record_consent(s1, null, 'privacy_terms_abroad', true, 'campus-privacy-v0.4', 'campus-terms-beta-v0.4',
                                'campus-consent-v0.3-he', 'he', 'paper', '{"document_ref":"scan-1","recorded_by":"staff"}');
  begin
    perform public.record_consent(s1, null, 'privacy_terms_abroad', true, 'campus-privacy-v0.4', 'campus-terms-beta-v0.4',
                                  'campus-consent-v0.3-he', 'he', 'telegram', '{}');
    raise exception 'FAIL C8 telegram without evidence';
  exception when check_violation then null; end;
  execute 'reset role';
  raise notice 'PASS C consent-gated student writes';
end $$;

-- N: round 3 (N3) - BEQA / biometric consent / course writes need the current consent.
do $$
declare
  s3 uuid := '00000000-0000-0000-0000-0000000c0701';
  so uuid := '00000000-0000-0000-0000-0000000c0702';
  crs uuid := '00000000-0000-0000-0000-0000000c07c1';
  crs2 uuid := '00000000-0000-0000-0000-0000000c07c2';
  les uuid := '00000000-0000-0000-0000-0000000c07d1';
  enr uuid := '00000000-0000-0000-0000-0000000c07e1';
  web jsonb := '{"ip_hash":"00ff","user_agent":"t"}';
  ok boolean; st text; res jsonb := '{}';
  pulse boolean := exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'beqa_pulse_clicks'
                             and policyname = 'student insert own pulse clicks');
begin
  set local session_replication_role = replica;  -- fixtures only: skip FK/guard triggers
  insert into auth.users(id, email) values (s3, 'cs3@test.local'), (so, 'cso@test.local');
  insert into public.user_roles(user_id, role) values (s3, 'student'), (so, 'staff') on conflict do nothing;
  insert into public.candidates(id, full_name, email, user_id, beqa_access)
    values ('00000000-0000-0000-0000-0000000c07a1', 'CS3', 'cs3@test.local', s3, true);
  insert into public.online_courses(id, title_he, status) values (crs, 'c', 'published'), (crs2, 'c2', 'published');
  insert into public.course_enrollments(id, course_id, student_id) values (enr, crs, s3);
  for st in select unnest(array['none', 'current', 'withdrawn']) loop
    if st = 'current' then
      execute 'set local role service_role';
      perform public.record_consent(s3, null, 'privacy_terms_abroad', true, 'campus-privacy-v0.4', 'campus-terms-beta-v0.4',
                                    'campus-consent-v0.3-he', 'he', 'web', web);
      execute 'reset role';
    elsif st = 'withdrawn' then
      execute 'set local role service_role';
      perform public.record_consent(s3, null, 'privacy_terms_abroad', false, 'campus-privacy-v0.4', 'campus-terms-beta-v0.4',
                                    'campus-consent-v0.3-he', 'he', 'web', web);
      execute 'reset role';
      -- same transaction => same now(); make the withdrawal the newest row
      update public.consents set created_at = now() + interval '1 second'
       where user_id = s3 and granted = false;
    end if;
    delete from public.course_enrollments where student_id = s3 and id <> enr;
    delete from public.course_lesson_progress where enrollment_id = enr;
    perform set_config('request.jwt.claims', json_build_object('sub', s3, 'role', 'authenticated')::text, true);
    execute 'set local role authenticated';
    begin insert into public.raw_biometric_log(session_id, student_id, event_type) values (gen_random_uuid(), s3, 'x'); ok := true;
    exception when insufficient_privilege then ok := false; end;
    res := res || jsonb_build_object(st || ':bio_log', ok);
    if pulse then
      begin insert into public.beqa_pulse_clicks(session_id, student_id) values (gen_random_uuid(), s3); ok := true;
      exception when insufficient_privilege then ok := false; end;
      res := res || jsonb_build_object(st || ':pulse', ok);
    end if;
    begin insert into public.biometric_consents(student_id, consent_text_version, granted) values (s3, 'v1', true); ok := true;
    exception when insufficient_privilege then ok := false; end;
    res := res || jsonb_build_object(st || ':bio_consent_grant', ok);
    begin insert into public.course_enrollments(course_id, student_id) values (crs2, s3); ok := true;
    exception when insufficient_privilege then ok := false; end;
    res := res || jsonb_build_object(st || ':enroll', ok);
    begin insert into public.course_lesson_progress(enrollment_id, lesson_id) values (enr, les); ok := true;
    exception when insufficient_privilege then ok := false; end;
    res := res || jsonb_build_object(st || ':progress', ok);
    -- refusing biometric consent is always possible
    insert into public.biometric_consents(student_id, consent_text_version, granted) values (s3, 'v1', false);
    -- reads stay allowed
    perform count(*) from public.course_enrollments where student_id = s3;
    execute 'reset role';
  end loop;
  if exists (select 1 from jsonb_each_text(res) e(k, v) where k !~ '^current:' and v::boolean) then
    raise exception 'FAIL N1 write without current consent: %', (select string_agg(k, ',') from jsonb_each_text(res) e(k, v) where k !~ '^current:' and v::boolean); end if;
  if exists (select 1 from jsonb_each_text(res) e(k, v) where k ~ '^current:' and not v::boolean) then
    raise exception 'FAIL N2 write denied with current consent: %', (select string_agg(k, ',') from jsonb_each_text(res) e(k, v) where k ~ '^current:' and not v::boolean); end if;
  -- N3: lesson progress UPDATE after withdrawal is denied (row from 'current' was deleted; make one)
  insert into public.course_lesson_progress(enrollment_id, lesson_id) values (enr, les);
  perform set_config('request.jwt.claims', json_build_object('sub', s3, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  begin update public.course_lesson_progress set status = 'completed' where enrollment_id = enr; ok := true;
  exception when insufficient_privilege then ok := false; end;
  execute 'reset role';
  if ok then raise exception 'FAIL N3 progress update after withdrawal'; end if;
  -- N4: staff (no consent row) still enrols / writes progress as before
  perform set_config('request.jwt.claims', json_build_object('sub', so, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  insert into public.course_enrollments(course_id, student_id) values (crs, so);
  update public.course_lesson_progress set status = 'completed' where enrollment_id = enr;
  execute 'reset role';
  raise notice 'PASS N round-3 consent-gated writes (pulse policy %)', case when pulse then 'present+gated' else 'absent (dropped by #5)' end;
end $$;

rollback;
