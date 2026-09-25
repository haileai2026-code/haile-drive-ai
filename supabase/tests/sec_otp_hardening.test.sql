-- fix/sec-otp-hardening: lockout, throttle, plaintext TTL.
-- Run ONLY against a local / branch DB as postgres; rolled back at the end.
-- Synthetic phone numbers only. Hashes are sha256 of the 6-digit code
-- (same as hashOtp() in phone-login.functions.ts).
begin;

do $$
declare
  good text := encode(extensions.digest('123456', 'sha256'), 'hex');
  bad  text := encode(extensions.digest('000000', 'sha256'), 'hex');
  r record; i int; n int;
begin
  -- throttle: first request allowed
  if not public.phone_otp_request_allowed('9720000000001') then raise exception 'FAIL T1'; end if;
  insert into public.phone_login_requests(phone, otp_hash, otp_plain, status)
    values ('9720000000001', good, '123456', 'pending');

  -- plaintext kept while pending, scrubbed on approve (trigger)
  select count(*) into n from public.phone_login_requests where phone = '9720000000001' and otp_plain is not null;
  if n <> 1 then raise exception 'FAIL P1: plain should exist while pending'; end if;
  update public.phone_login_requests set status = 'approved' where phone = '9720000000001';
  select count(*) into n from public.phone_login_requests where phone = '9720000000001' and otp_plain is not null;
  if n <> 0 then raise exception 'FAIL P2: plain not scrubbed on approve'; end if;

  -- correct code works before any failures
  select * into r from public.phone_otp_verify('9720000000001', good);
  if r.outcome <> 'ok' or r.status <> 'approved' then raise exception 'FAIL V1: %', r.outcome; end if;

  -- 5 wrong attempts
  for i in 1..5 loop
    select * into r from public.phone_otp_verify('9720000000001', bad);
    if r.outcome <> 'invalid' then raise exception 'FAIL V2 attempt %: %', i, r.outcome; end if;
  end loop;
  -- 6th attempt is rejected even with the correct code
  select * into r from public.phone_otp_verify('9720000000001', good);
  if r.outcome <> 'locked' then raise exception 'FAIL V3: expected locked, got %', r.outcome; end if;
  -- and no new code can be requested while locked
  if public.phone_otp_request_allowed('9720000000001') then raise exception 'FAIL T2: request allowed while locked'; end if;

  -- request throttle: 3 per 15 min
  insert into public.phone_login_requests(phone, otp_hash, status)
    select '9720000000002', bad, 'pending' from generate_series(1,3);
  if public.phone_otp_request_allowed('9720000000002') then raise exception 'FAIL T3: 4th request allowed'; end if;

  -- TTL purge: pending plaintext older than 10 min is nulled; expired rows (>1 day) deleted
  insert into public.phone_login_requests(phone, otp_hash, otp_plain, status, created_at, expires_at) values
    ('9720000000003', good, '123456', 'pending', now() - interval '11 minutes', now() - interval '1 minute'),
    ('9720000000004', good, '123456', 'pending', now() - interval '3 days', now() - interval '2 days');
  perform public.purge_phone_otps();
  select count(*) into n from public.phone_login_requests where phone = '9720000000003' and otp_plain is null;
  if n <> 1 then raise exception 'FAIL P3: plain not purged after TTL'; end if;
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
