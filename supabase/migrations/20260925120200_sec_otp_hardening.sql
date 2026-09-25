-- =====================================================================
-- fix/sec-otp-hardening  (plan A2 + A3)
--  * attempts column + per-phone lockout (5 failed verifications / 15 min),
--    evaluated atomically in public.phone_otp_verify() (service role only).
--  * per-phone request throttle in public.phone_otp_request_allowed().
--  * otp_plain is never kept once a request leaves 'pending' (trigger) and
--    is purged 10 min after creation; expired rows are deleted after 1 day
--    (public.purge_phone_otps(), pg_cron every 5 min).
--
-- DRAFT: NOT applied to any database. Applying to cmvv = gate G2 (Sol).
-- Only ephemeral login-code rows are affected by the purge job.
-- =====================================================================

alter table public.phone_login_requests
  add column if not exists attempts integer not null default 0;

create index if not exists phone_login_requests_phone_created_idx
  on public.phone_login_requests (phone, created_at desc);

-- 1. otp_plain only lives while the request is pending.
create or replace function public.phone_login_requests_scrub_plain()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status <> 'pending' then
    new.otp_plain := null;
  end if;
  return new;
end;
$$;
drop trigger if exists phone_login_requests_scrub_plain on public.phone_login_requests;
create trigger phone_login_requests_scrub_plain
  before insert or update on public.phone_login_requests
  for each row execute function public.phone_login_requests_scrub_plain();

-- 2. Request throttle: max 3 requests per phone per 15 min, and none while
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

-- 3. Atomic verify: lockout check, match, failure counting.
--    Returns one row: outcome in ('locked','invalid','ok') and, for 'ok',
--    the matched request id/status/expiry. The row lock serialises
--    concurrent guesses for the same phone.
create or replace function public.phone_otp_verify(p_phone text, p_otp_hash text)
returns table (outcome text, request_id uuid, status text, expires_at timestamptz)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_failures integer;
  v_match    public.phone_login_requests%rowtype;
  v_latest   uuid;
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

  select * into v_match
    from public.phone_login_requests r
   where r.phone = p_phone and r.otp_hash = p_otp_hash
   order by r.created_at desc
   limit 1;

  if not found then
    select r.id into v_latest
      from public.phone_login_requests r
     where r.phone = p_phone
     order by r.created_at desc
     limit 1;
    if v_latest is not null then
      update public.phone_login_requests set attempts = attempts + 1 where id = v_latest;
    end if;
    return query select 'invalid'::text, null::uuid, null::text, null::timestamptz;
    return;
  end if;

  return query select 'ok'::text, v_match.id, v_match.status, v_match.expires_at;
end;
$$;
revoke all on function public.phone_otp_verify(text, text) from public, anon, authenticated;
grant execute on function public.phone_otp_verify(text, text) to service_role;

-- 4. Purge: plaintext after 10 min, expired rows after 1 day.
create or replace function public.purge_phone_otps()
returns void
language sql
volatile
security definer
set search_path = ''
as $$
  update public.phone_login_requests
     set otp_plain = null
   where otp_plain is not null
     and (status <> 'pending' or created_at < now() - interval '10 minutes');
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
