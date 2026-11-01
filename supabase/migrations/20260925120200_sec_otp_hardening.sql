-- =====================================================================
-- fix/sec-otp-hardening  (plan A2 + A3, CTO decisions 2026-09-25)
--  * Codes are stored as HMAC-SHA256(OTP_PEPPER, code) ONLY (server-only
--    secret OTP_PEPPER, see src/lib/otp.ts). otp_plain is forced to NULL by
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
--  * Review fixes (section 8): no client/staff table access, approved_by
--    audit, race-free phone_otp_request (advisory lock, per-IP + global
--    hourly caps), claim/consume so a code is used only after account setup.
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
  check (status in ('pending','approved','verified','rejected','used','expired','failed'));

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
     and status in ('pending','approved','verified');
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
--             'ok'      - correct, approved, unexpired: claimed ('verified');
--                         phone_otp_consume() marks it 'used' after setup
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
    -- newest request is already terminal (used/expired/failed/rejected) or
    -- claimed ('verified'): no active code. Guesses are NOT counted against
    -- dead rows (review fix), so they cannot lock out a fresh request.
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

  -- approved + correct + unexpired: CLAIM it ('verified'). It is consumed
  -- ('used') by phone_otp_consume() only after account setup succeeded, or
  -- released back to 'approved' by phone_otp_release() if setup failed. A
  -- claimed code cannot be verified a second time (single use).
  update public.phone_login_requests set status = 'verified' where id = v_req.id;
  return query select 'ok'::text, v_req.id, 'verified'::text, v_req.expires_at;
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
   where status in ('pending','approved','verified')
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

-- 6. HMAC switch: codes issued before this migration were hashed without the
--    pepper and can no longer verify. Expire any still-active ones (ephemeral
--    login codes only; the student simply requests a new code).
update public.phone_login_requests set status = 'expired' where status in ('pending','approved');

-- 7. Explicit grants (Supabase breaking change 2026-10-30). Minimum,
--    re-runnable. Rollback (grants only):
--    supabase/rollback/20260925120200_sec_otp_hardening.down.sql
--    Table: anon and authenticated nothing (section 8a drops the staff
--    policies; the app reads through service-role server functions only);
--    service_role DML used by phone-login.functions.ts.
--    No sequences (uuid key).
revoke all on public.phone_login_requests from anon, authenticated, service_role;
grant select, insert, update, delete on public.phone_login_requests to service_role;
--    RPCs: service_role only (server functions). Trigger functions: nobody
--    (triggers do not check EXECUTE).
revoke all on function public.phone_otp_request_allowed(text) from public, anon, authenticated;
revoke all on function public.phone_otp_verify(text, text)     from public, anon, authenticated;
revoke all on function public.purge_phone_otps()               from public, anon, authenticated;
grant execute on function public.phone_otp_request_allowed(text) to service_role;
grant execute on function public.phone_otp_verify(text, text)     to service_role;
grant execute on function public.purge_phone_otps()               to service_role;
revoke all on function public.phone_login_requests_guard()     from public, anon, authenticated, service_role;
revoke all on function public.phone_login_requests_supersede() from public, anon, authenticated, service_role;

-- =====================================================================
-- 8. Security review fixes (2026-11-01). Re-runnable.
--    (CAPTCHA on the request step is a noted follow-up, not part of this PR.)
-- =====================================================================
-- 8a. Staff never read phone_login_requests (incl. otp_hash) directly: the
--     admin screen goes through service-role server functions only.
drop policy if exists "owner staff manage phone requests" on public.phone_login_requests;
drop policy if exists "owner staff read phone requests"   on public.phone_login_requests;
revoke all on public.phone_login_requests from anon, authenticated;

-- 8b. Audit + per-IP limit columns.
alter table public.phone_login_requests
  add column if not exists approved_by uuid references auth.users (id) on delete set null,
  add column if not exists approved_at timestamptz,
  add column if not exists request_ip_hash text;
alter table public.phone_login_requests drop constraint if exists phone_login_requests_ip_hash_check;
alter table public.phone_login_requests add constraint phone_login_requests_ip_hash_check
  check (request_ip_hash is null or request_ip_hash ~ '^[0-9a-f]{64}$');
create index if not exists phone_login_requests_ip_created_idx
  on public.phone_login_requests (request_ip_hash, created_at desc) where request_ip_hash is not null;
create index if not exists phone_login_requests_created_idx
  on public.phone_login_requests (created_at desc);

-- 8c. Race-free request: serialised per phone (advisory xact lock), then
--     lockout, per-phone throttle, per-IP limit, global hourly cap, insert.
--     outcome: 'ok' | 'locked' | 'limited' (any throttle/cap; the app shows
--     one generic message for everything except ok / locked).
-- sms_reserved_at: SMS slot reserved INSIDE phone_otp_request under the
--   global advisory lock (security round 3, N2), before Twilio is called.
-- sms_sent_at: set by phone_otp_sms_result() when Twilio accepted the SMS.
-- Global SMS cap counts reserved OR sent in the last hour; a failed send
-- releases its reservation (sms_reserved_at := null).
alter table public.phone_login_requests add column if not exists sms_sent_at timestamptz;
alter table public.phone_login_requests add column if not exists sms_reserved_at timestamptz;
create index if not exists phone_login_requests_sms_sent_idx
  on public.phone_login_requests (sms_sent_at) where sms_sent_at is not null;
create index if not exists phone_login_requests_sms_reserved_idx
  on public.phone_login_requests (sms_reserved_at) where sms_reserved_at is not null;

-- signature changed (p_reserve_sms added): drop the 3-arg version first.
drop function if exists public.phone_otp_request(text, text, text);
create or replace function public.phone_otp_request(p_phone text, p_otp_hash text, p_ip_hash text,
                                                    p_reserve_sms boolean default false)
returns table (outcome text, request_id uuid)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  -- Limits (constants; mirrored in OTP_LIMITS in src/lib/otp.ts)
  c_phone_per_15min constant integer := 3;
  c_fail_per_15min  constant integer := 5;
  c_ip_per_hour     constant integer := 10;
  c_global_per_hour constant integer := 200;
  -- hard cap on ALL request rows per hour (manual mode / no IP included),
  -- N5 interim until Turnstile CAPTCHA; phone login stays OFF until then.
  c_rows_per_hour   constant integer := 1000;
  v_id uuid;
begin
  if p_phone !~ '^[+][1-9][0-9]{6,14}$' or p_otp_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid input' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtext(p_phone));

  if (select coalesce(sum(r.attempts), 0) from public.phone_login_requests r
       where r.phone = p_phone and r.created_at > now() - interval '15 minutes') >= c_fail_per_15min then
    return query select 'locked'::text, null::uuid; return;
  end if;
  if (select count(*) from public.phone_login_requests r
       where r.phone = p_phone and r.created_at > now() - interval '15 minutes') >= c_phone_per_15min
     then
    return query select 'limited'::text, null::uuid; return;
  end if;
  -- per-IP and global counts are serialised across phones (re-review LOW);
  -- lock order is always phone -> global, so no deadlock.
  perform pg_advisory_xact_lock(hashtext('otp-global'));
  if (p_ip_hash is not null and
         (select count(*) from public.phone_login_requests r
           where r.request_ip_hash = p_ip_hash and r.created_at > now() - interval '1 hour') >= c_ip_per_hour)
     -- hourly row cap over every request (SMS or not)
     or (select count(*) from public.phone_login_requests r
          where r.created_at > now() - interval '1 hour') >= c_rows_per_hour
     -- global SMS cap: slots reserved (under this lock) or sent in the last
     -- hour; only checked when this request wants to send an SMS
     or (p_reserve_sms and
         (select count(*) from public.phone_login_requests r
           where coalesce(r.sms_sent_at, r.sms_reserved_at) > now() - interval '1 hour') >= c_global_per_hour) then
    return query select 'limited'::text, null::uuid; return;
  end if;

  insert into public.phone_login_requests (phone, otp_hash, status, request_ip_hash, sms_reserved_at)
  values (p_phone, p_otp_hash, 'pending', p_ip_hash, case when p_reserve_sms then now() end)
  returning id into v_id;
  return query select 'ok'::text, v_id;
end;
$$;

-- 8d. Consume only after account setup succeeded; release on failure.
create or replace function public.phone_otp_consume(p_request_id uuid, p_user_id uuid)
returns boolean
language sql
volatile
security definer
set search_path = ''
as $$
  with u as (
    update public.phone_login_requests
       set status = 'used', user_id = p_user_id
     where id = p_request_id and status = 'verified'
    returning 1)
  select exists (select 1 from u);
$$;
create or replace function public.phone_otp_release(p_request_id uuid)
returns boolean
language sql
volatile
security definer
set search_path = ''
as $$
  with u as (
    update public.phone_login_requests
       set status = 'approved'
     where id = p_request_id and status = 'verified' and expires_at > now()
    returning 1)
  select exists (select 1 from u);
$$;

-- 8d2. Result of the SMS send for a reserved slot: sent -> approved +
--      sms_sent_at; failed -> reservation released (slot returns to the cap).
create or replace function public.phone_otp_sms_result(p_request_id uuid, p_sent boolean)
returns boolean
language sql
volatile
security definer
set search_path = ''
as $$
  with u as (
    update public.phone_login_requests
       set sms_sent_at     = case when p_sent then now() end,
           sms_reserved_at = case when p_sent then sms_reserved_at end,
           status          = case when p_sent and status = 'pending' then 'approved' else status end
     where id = p_request_id and sms_reserved_at is not null and sms_sent_at is null
    returning 1)
  select exists (select 1 from u);
$$;

-- 8e. Exact auth-user lookup for the synthetic phone e-mail (replaces
--     listUsers({perPage:200})). First match in the given preference order
--     (E.164 form first, then legacy formats).
create or replace function public.phone_auth_user_lookup(p_emails text[])
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select u.id
    from unnest(p_emails) with ordinality e(email, ord)
    join auth.users u on lower(u.email) = lower(e.email)
   order by e.ord
   limit 1;
$$;

-- 8f. Explicit grants (minimum): service_role only.
revoke all on function public.phone_otp_request(text, text, text, boolean) from public, anon, authenticated;
revoke all on function public.phone_otp_sms_result(uuid, boolean)  from public, anon, authenticated;
revoke all on function public.phone_otp_consume(uuid, uuid)       from public, anon, authenticated;
revoke all on function public.phone_otp_release(uuid)             from public, anon, authenticated;
revoke all on function public.phone_auth_user_lookup(text[])      from public, anon, authenticated;
grant execute on function public.phone_otp_request(text, text, text, boolean) to service_role;
grant execute on function public.phone_otp_sms_result(uuid, boolean)  to service_role;
grant execute on function public.phone_otp_consume(uuid, uuid)       to service_role;
grant execute on function public.phone_otp_release(uuid)             to service_role;
grant execute on function public.phone_auth_user_lookup(text[])      to service_role;
