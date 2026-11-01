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
  foreach f in array array['public.record_consent(uuid,uuid,text,boolean,text,text,text,text,text,jsonb)','public.consent_ok(uuid)',
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

rollback;
