-- =====================================================================
-- fix/sec-otp-hardening  (plan A2 + A3, CTO decisions 2026-09-25)
--  * Codes are stored as a SHA-256 hash ONLY. otp_plain is forced to NULL by
--    trigger and by a CHECK constraint; the manual staff flow now generates
--    the code at approval time and shows it to staff once, in the response.
--  * 10-minute code TTL, enforced in the DB: expires_at can never be more
--    than 10 min after issue (re-issuing a code resets it), and verify
--    rejects + expires stale codes.
--  * At most 5 wrong attempts per code; the 5th marks it 'failed' and a new
--    request is required. Only the newest code for a phone is active (a new
--    request supersedes older ones -> 'expired'). A correct code is consumed
--    atomically ('used') inside verify, so it works once.
--  * Per-phone lockout: 5 failed verifications / 15 min (also blocks new
--    requests for that window).
--  * Request throttle: max 3 requests per phone per 15 min.
--  * purge_phone_otps(): expires stale codes, deletes rows expired > 1 day
--    (pg_cron every 5 min).
--
-- DRAFT: NOT applied to any database. Applying to cmvv = gate G2 (Sol).
-- Only ephemeral login-code rows are affected.
-- =====================================================================

alter table public.phone_login_requests
  add column if not exists attempts integer not null default 0;

create index if not exists phone_login_requests_phone_created_idx
  on public.phone_login_requests (phone, created_at desc);

-- 0. New terminal statuses.
alter table public.phone_login_requests
  drop constraint if exists phone_login_requests_status_check;
alter table public.phone_login_requests
  add constraint phone_login_requests_status_check
  check (status in ('pending','approved','rejected','used','expired','failed'));

-- 1. Hash only + TTL guard.
--    The otp_plain column is kept (NULL-only) so an older app build that still
--    writes/reads it keeps working during rollout; drop it in a follow-up.
update public.phone_login_requests set otp_plain = null where otp_plain is not null;

create or replace function public.phone_login_requests_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.otp_plain := null;  -- plaintext codes are never stored
  if tg_op = 'INSERT' then
    new.expires_at := least(coalesce(new.expires_at, now() + interval '10 minutes'),
                            now() + interval '10 minutes',
                            new.created_at + interval '10 minutes');
  elsif new.otp_hash is distinct from old.otp_hash then
    -- a new code was issued (manual approval): fresh 10-min TTL, fresh attempts
    new.expires_at := now() + interval '10 minutes';
    new.attempts := 0;
  else
    -- TTL can be shortened but never extended
    new.expires_at := least(new.expires_at, old.expires_at);
  end if;
  return new;
end;
$$;

drop trigger if exists phone_login_requests_scrub_plain on public.phone_login_requests;
drop function if exists public.phone_login_requests_scrub_plain();
drop trigger if exists phone_login_requests_guard on public.phone_login_requests;
create trigger phone_login_requests_guard
  before insert or update on public.phone_login_requests
  for each row execute function public.phone_login_requests_guard();

alter table public.phone_login_requests
  drop constraint if exists phone_login_requests_no_plaintext;
alter table public.phone_login_requests
  add constraint phone_login_requests_no_plaintext check (otp_plain is null);

-- 2. Only the newest code per phone is active.
create or replace function public.phone_login_requests_supersede()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  update public.phone_login_requests
     set status = 'expired'
   where phone = new.phone
     and id <> new.id
     and status in ('pending','approved');
  return null;
end;
$$;
drop trigger if exists phone_login_requests_supersede on public.phone_login_requests;
create trigger phone_login_requests_supersede
  after insert on public.phone_login_requests
  for each row execute function public.phone_login_requests_supersede();

-- 3. Request throttle: max 3 requests per phone per 15 min, and none while
--    the phone is locked out by failed verifications.
create or replace function public.phone_otp_request_allowed(p_phone text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    (select count(*) from public.phone_login_requests r
      where r.phone = p_phone and r.created_at > now() - interval '15 minutes') < 3
    and
    (select coalesce(sum(r.attempts), 0) from public.phone_login_requests r
      where r.phone = p_phone and r.created_at > now() - interval '15 minutes') < 5;
$$;
revoke all on function public.phone_otp_request_allowed(text) from public, anon, authenticated;
grant execute on function public.phone_otp_request_allowed(text) to service_role;

-- 4. Atomic verify against the phone's single active code.
--    outcome: 'locked'  - 5 failed attempts for this phone in 15 min
--             'invalid' - no active code, or wrong code (attempt counted)
--             'failed'  - wrong code and this was attempt 5: code invalidated
--             'expired' - code older than its 10-min TTL: code invalidated
--             'pending' - correct code but staff has not approved yet
--             'rejected'- request was rejected by staff
--             'ok'      - correct, approved, unexpired: consumed ('used')
create or replace function public.phone_otp_verify(p_phone text, p_otp_hash text)
returns table (outcome text, request_id uuid, status text, expires_at timestamptz)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_failures integer;
  v_req      public.phone_login_requests%rowtype;
  v_latest   uuid;
  v_attempts integer;
begin
  -- serialise per phone: lock this phone's recent rows
  perform 1 from public.phone_login_requests r
   where r.phone = p_phone and r.created_at > now() - interval '15 minutes'
   for update;

  select coalesce(sum(r.attempts), 0) into v_failures
    from public.phone_login_requests r
   where r.phone = p_phone and r.created_at > now() - interval '15 minutes';
  if v_failures >= 5 then
    return query select 'locked'::text, null::uuid, null::text, null::timestamptz;
    return;
  end if;

  select * into v_req
    from public.phone_login_requests r
   where r.phone = p_phone
   order by r.created_at desc
   limit 1
   for update;

  if not found then
    return query select 'invalid'::text, null::uuid, null::text, null::timestamptz;
    return;
  end if;

  if v_req.status not in ('pending','approved') then
    -- newest request is already terminal: no active code; count the guess
    update public.phone_login_requests set attempts = attempts + 1 where id = v_req.id;
    if v_req.status = 'rejected' and v_req.otp_hash = p_otp_hash then
      return query select 'rejected'::text, v_req.id, v_req.status, v_req.expires_at;
    else
      return query select 'invalid'::text, null::uuid, null::text, null::timestamptz;
    end if;
    return;
  end if;

  if v_req.expires_at <= now() then
    update public.phone_login_requests set status = 'expired' where id = v_req.id;
    return query select 'expired'::text, v_req.id, 'expired'::text, v_req.expires_at;
    return;
  end if;

  if v_req.otp_hash is distinct from p_otp_hash then
    update public.phone_login_requests
       set attempts = attempts + 1
     where id = v_req.id
     returning attempts into v_attempts;
    if v_attempts >= 5 then
      update public.phone_login_requests set status = 'failed' where id = v_req.id;
      return query select 'failed'::text, v_req.id, 'failed'::text, v_req.expires_at;
    else
      return query select 'invalid'::text, null::uuid, null::text, null::timestamptz;
    end if;
    return;
  end if;

  if v_req.status = 'pending' then
    return query select 'pending'::text, v_req.id, v_req.status, v_req.expires_at;
    return;
  end if;

  -- approved + correct + unexpired: consume now (single use)
  update public.phone_login_requests set status = 'used' where id = v_req.id;
  return query select 'ok'::text, v_req.id, 'used'::text, v_req.expires_at;
end;
$$;
revoke all on function public.phone_otp_verify(text, text) from public, anon, authenticated;
grant execute on function public.phone_otp_verify(text, text) to service_role;

-- 5. Purge: expire stale active codes; delete rows expired more than 1 day ago.
create or replace function public.purge_phone_otps()
returns void
language sql
volatile
security definer
set search_path = ''
as $$
  update public.phone_login_requests
     set status = 'expired'
   where status in ('pending','approved')
     and expires_at <= now();
  delete from public.phone_login_requests
   where expires_at < now() - interval '1 day';
$$;
revoke all on function public.purge_phone_otps() from public, anon, authenticated;
grant execute on function public.purge_phone_otps() to service_role;

-- No inline purge here (DDL-only migration); the first cron run does it.
do $$
begin
  perform cron.unschedule('purge-phone-otps');
exception when others then null;
end $$;
select cron.schedule('purge-phone-otps', '*/5 * * * *', $cron$ select public.purge_phone_otps(); $cron$);
