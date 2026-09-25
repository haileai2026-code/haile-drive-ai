-- fix/sec-otp-hardening: hash-only storage, 10-min TTL, 5 attempts per code,
-- per-phone lockout, request throttle, purge.
-- Run ONLY against a local / branch DB as postgres; rolled back at the end.
-- Synthetic phone numbers only. Hashes are sha256 of the 6-digit code
-- (same as hashOtp() in phone-login.functions.ts).
begin;

do $$
declare
  good text := encode(extensions.digest('123456', 'sha256'), 'hex');
  bad  text := encode(extensions.digest('000000', 'sha256'), 'hex');
  new_code text := encode(extensions.digest('654321', 'sha256'), 'hex');
  r record; i int; n int; rid uuid; rid2 uuid; ts timestamptz;
begin
  -- H: hash only - plaintext is dropped on insert/update, constraint present
  insert into public.phone_login_requests(phone, otp_hash, otp_plain, status)
    values ('9720000000001', good, '123456', 'pending') returning id into rid;
  select count(*) into n from public.phone_login_requests where otp_plain is not null;
  if n <> 0 then raise exception 'FAIL H1: plaintext stored on insert'; end if;
  update public.phone_login_requests set otp_plain = '123456' where id = rid;
  select count(*) into n from public.phone_login_requests where otp_plain is not null;
  if n <> 0 then raise exception 'FAIL H2: plaintext stored on update'; end if;
  perform 1 from pg_constraint where conname = 'phone_login_requests_no_plaintext';
  if not found then raise exception 'FAIL H3: no-plaintext constraint missing'; end if;

  -- TTL: expires_at capped at 10 min on insert, never extended on update
  insert into public.phone_login_requests(phone, otp_hash, status, expires_at)
    values ('9720000000009', good, 'pending', now() + interval '2 hours') returning id, expires_at into rid2, ts;
  if ts > now() + interval '10 minutes' then raise exception 'FAIL L1: TTL not capped on insert'; end if;
  update public.phone_login_requests set expires_at = now() + interval '1 day' where id = rid2 returning expires_at into ts;
  if ts > now() + interval '10 minutes' then raise exception 'FAIL L2: TTL extended on update'; end if;

  -- pending + correct code => 'pending' (no consumption)
  select * into r from public.phone_otp_verify('9720000000001', good);
  if r.outcome <> 'pending' then raise exception 'FAIL V0: %', r.outcome; end if;

  -- manual approval re-issues the code: new hash, fresh TTL + attempts
  update public.phone_login_requests set attempts = 2 where id = rid;
  update public.phone_login_requests set status = 'approved', otp_hash = new_code where id = rid;
  select attempts into n from public.phone_login_requests where id = rid;
  if n <> 0 then raise exception 'FAIL A1: attempts not reset on re-issue'; end if;
  -- the old code no longer works
  select * into r from public.phone_otp_verify('9720000000001', good);
  if r.outcome <> 'invalid' then raise exception 'FAIL A2: old code accepted: %', r.outcome; end if;
  -- correct code works once and is consumed
  select * into r from public.phone_otp_verify('9720000000001', new_code);
  if r.outcome <> 'ok' or r.status <> 'used' then raise exception 'FAIL V1: %', r.outcome; end if;
  select * into r from public.phone_otp_verify('9720000000001', new_code);
  if r.outcome = 'ok' then raise exception 'FAIL V1b: code reusable'; end if;

  -- 5 attempts per code: 4x invalid, 5th => failed + code invalidated
  insert into public.phone_login_requests(phone, otp_hash, status)
    values ('9720000000005', good, 'approved') returning id into rid;
  for i in 1..4 loop
    select * into r from public.phone_otp_verify('9720000000005', bad);
    if r.outcome <> 'invalid' then raise exception 'FAIL C1 attempt %: %', i, r.outcome; end if;
  end loop;
  select * into r from public.phone_otp_verify('9720000000005', bad);
  if r.outcome <> 'failed' then raise exception 'FAIL C2: expected failed, got %', r.outcome; end if;
  select status into r from public.phone_login_requests where id = rid;
  if r.status <> 'failed' then raise exception 'FAIL C3: code not invalidated (%)', r.status; end if;
  -- the correct code is dead now (phone is also locked for 15 min)
  select * into r from public.phone_otp_verify('9720000000005', good);
  if r.outcome = 'ok' then raise exception 'FAIL C4: invalidated code accepted'; end if;
  if r.outcome <> 'locked' then raise exception 'FAIL C5: expected locked, got %', r.outcome; end if;
  if public.phone_otp_request_allowed('9720000000005') then raise exception 'FAIL T2: request allowed while locked'; end if;

  -- per-code limit resets with a NEW request (after the lockout window)
  update public.phone_login_requests set created_at = now() - interval '20 minutes',
         expires_at = now() - interval '10 minutes' where phone = '9720000000005';
  if not public.phone_otp_request_allowed('9720000000005') then raise exception 'FAIL T4: new request blocked after window'; end if;
  insert into public.phone_login_requests(phone, otp_hash, status) values ('9720000000005', good, 'approved');
  select * into r from public.phone_otp_verify('9720000000005', good);
  if r.outcome <> 'ok' then raise exception 'FAIL C6: new code rejected: %', r.outcome; end if;

  -- 10-min TTL: an expired code is rejected even if correct, and invalidated
  insert into public.phone_login_requests(phone, otp_hash, status, created_at, expires_at)
    values ('9720000000006', good, 'approved', now() - interval '11 minutes', now() + interval '1 hour')
    returning id, expires_at into rid, ts;
  if ts > now() then raise exception 'FAIL E0: TTL not derived from created_at'; end if;
  select * into r from public.phone_otp_verify('9720000000006', good);
  if r.outcome <> 'expired' then raise exception 'FAIL E1: expected expired, got %', r.outcome; end if;
  select status into r from public.phone_login_requests where id = rid;
  if r.status <> 'expired' then raise exception 'FAIL E2: status %', r.status; end if;

  -- a new request supersedes older active codes
  insert into public.phone_login_requests(phone, otp_hash, status) values ('9720000000007', good, 'approved') returning id into rid;
  insert into public.phone_login_requests(phone, otp_hash, status) values ('9720000000007', new_code, 'pending');
  select status into r from public.phone_login_requests where id = rid;
  if r.status <> 'expired' then raise exception 'FAIL S1: old code not superseded (%)', r.status; end if;

  -- request throttle: 3 per 15 min
  insert into public.phone_login_requests(phone, otp_hash, status)
    select '9720000000002', bad, 'pending' from generate_series(1,3);
  if public.phone_otp_request_allowed('9720000000002') then raise exception 'FAIL T3: 4th request allowed'; end if;

  -- purge: stale active codes expired; rows expired > 1 day deleted
  insert into public.phone_login_requests(phone, otp_hash, status, created_at) values
    ('9720000000003', good, 'pending', now() - interval '11 minutes'),
    ('9720000000004', good, 'pending', now() - interval '3 days');
  perform public.purge_phone_otps();
  select count(*) into n from public.phone_login_requests where phone = '9720000000003' and status = 'expired';
  if n <> 1 then raise exception 'FAIL P3: stale code not expired by purge'; end if;
  select count(*) into n from public.phone_login_requests where phone = '9720000000004';
  if n <> 0 then raise exception 'FAIL P4: expired row not deleted'; end if;

  -- client roles cannot call the service-only functions
  if has_function_privilege('anon', 'public.phone_otp_verify(text,text)', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.phone_otp_verify(text,text)', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.purge_phone_otps()', 'EXECUTE')
     or has_function_privilege('anon', 'public.phone_otp_request_allowed(text)', 'EXECUTE') then
    raise exception 'FAIL G1: client role can execute OTP functions';
  end if;
  raise notice 'PASS sec_otp_hardening';
end $$;
rollback;
