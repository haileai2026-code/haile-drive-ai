-- =====================================================================
-- feat/consent-record
-- Append-only consent log (Campus Privacy Notice v0.4, Part C implementation
-- note): one row per checkbox decision. Latest row per (user, consent_type)
-- wins; withdrawal = a new row with granted = false. History is never
-- updated; rows are only removed when the auth user is erased (verified
-- deletion request -> ON DELETE CASCADE, or service role).
--
-- Depends on fix/sec-candidates-rls for public.is_staff().
-- DRAFT: NOT applied to any database. Applying to cmvv = gate G2 (Sol).
-- =====================================================================

create table if not exists public.consents (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null default auth.uid() references auth.users (id) on delete cascade,
  consent_type     text not null
                   check (consent_type in ('privacy_terms_abroad', 'partner_individual_progress', 'share_employer')),
  granted          boolean not null,
  notice_version   text not null check (length(notice_version) between 1 and 64),
  terms_version    text check (terms_version is null or length(terms_version) between 1 and 64),
  checkbox_version text not null check (length(checkbox_version) between 1 and 64),
  language         text not null check (language in ('he', 'am', 'ru')),
  created_at       timestamptz not null default now(),
  -- checkbox 1 (notice + terms + storage abroad) always records the terms version
  constraint consents_terms_version_for_checkbox1
    check (consent_type <> 'privacy_terms_abroad' or terms_version is not null)
);

create index if not exists consents_user_type_created_idx
  on public.consents (user_id, consent_type, created_at desc);

-- Server-side timestamp (clients cannot backdate) and no UPDATE, ever.
create or replace function public.consents_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    raise exception 'consents is append-only';
  end if;
  new.created_at := now();
  return new;
end;
$$;
drop trigger if exists consents_guard on public.consents;
create trigger consents_guard
  before insert or update on public.consents
  for each row execute function public.consents_guard();

alter table public.consents enable row level security;
alter table public.consents force row level security;

-- Grants: INSERT + SELECT only. No UPDATE / DELETE for any client role.
revoke all on public.consents from public, anon, authenticated;
grant select, insert on public.consents to authenticated;
grant all on public.consents to service_role;

drop policy if exists consents_insert_own on public.consents;
create policy consents_insert_own on public.consents
  for insert to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists consents_select_own on public.consents;
create policy consents_select_own on public.consents
  for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists consents_select_staff on public.consents;
create policy consents_select_staff on public.consents
  for select to authenticated
  using ((select public.is_staff()));

comment on table public.consents is
  'Append-only consent records (privacy notice / terms / checkbox versions). No UPDATE/DELETE for clients.';

-- Explicit grants (Supabase breaking change 2026-10-30: new tables/functions in
-- public get no default grants). Minimum, re-runnable. Rollback (grants only):
-- supabase/rollback/20260925120400_consent_record.down.sql
--   anon:          nothing
--   authenticated: SELECT + INSERT (exactly the consents_insert_own /
--                  consents_select_own / consents_select_staff policies)
--   service_role:  SELECT only (no server function writes consents; erasure
--                  runs via ON DELETE CASCADE from auth.users)
--   consents_guard(): trigger-only; no role needs EXECUTE (triggers do not
--                  check it), so it is revoked from PUBLIC and API roles.
--   No sequences (uuid key).
revoke all on public.consents from public, anon, authenticated, service_role;
grant select, insert on public.consents to authenticated;
grant select on public.consents to service_role;
revoke all on function public.consents_guard() from public, anon, authenticated, service_role;

-- =====================================================================
-- Security review fixes (2026-11-01). Re-runnable. Supersedes the client
-- INSERT path above: consents are now written ONLY by the server through
-- public.record_consent() (service_role).
--
-- RETENTION (DECIDED): consent records are kept for the life of the consent
-- plus 3 years. A consent's life ends when it is superseded by a newer row of
-- the same type for the same subject (new version or withdrawal), or when the
-- subject is erased. Erasure does NOT delete consent history: the subject
-- foreign keys are ON DELETE SET NULL, the row keeps only the pseudonymous
-- subject_pseudonym (random uuid, stable per subject) and subject_erased_at is
-- stamped. public.purge_expired_consents() (daily cron below) deletes rows
-- whose life ended more than 3 years ago.
-- Spec name "general_consents" = this table (public.consents); not renamed.
-- =====================================================================

-- R1. Subject, channel, evidence, pseudonym
alter table public.consents add column if not exists channel text not null default 'web';
alter table public.consents add column if not exists evidence jsonb not null default '{}'::jsonb;
alter table public.consents add column if not exists subject_candidate_id uuid;
alter table public.consents add column if not exists subject_pseudonym uuid not null default gen_random_uuid();
alter table public.consents add column if not exists subject_erased_at timestamptz;

alter table public.consents alter column user_id drop not null;
alter table public.consents alter column user_id drop default;
alter table public.consents drop constraint if exists consents_user_id_fkey;
alter table public.consents add constraint consents_user_id_fkey
  foreign key (user_id) references auth.users (id) on delete set null;
alter table public.consents drop constraint if exists consents_subject_candidate_id_fkey;
alter table public.consents add constraint consents_subject_candidate_id_fkey
  foreign key (subject_candidate_id) references public.candidates (id) on delete set null;

alter table public.consents drop constraint if exists consents_channel_check;
alter table public.consents add constraint consents_channel_check check (channel in ('web', 'whatsapp'));
-- Evidence is set by the server: web = ip_hash + user_agent; whatsapp = message_id + template.
alter table public.consents drop constraint if exists consents_evidence_check;
alter table public.consents add constraint consents_evidence_check check (
  jsonb_typeof(evidence) = 'object' and
  case channel
    when 'web'      then evidence ? 'ip_hash' and evidence ? 'user_agent'
    when 'whatsapp' then evidence ? 'message_id' and evidence ? 'template'
  end);
-- A subject is required. Written as a CHECK that also admits erased rows,
-- because ON DELETE SET NULL would otherwise violate it on erasure.
alter table public.consents drop constraint if exists consents_subject_check;
alter table public.consents add constraint consents_subject_check check (
  user_id is not null or subject_candidate_id is not null or subject_erased_at is not null);

create index if not exists consents_pseudonym_type_created_idx
  on public.consents (subject_pseudonym, consent_type, created_at desc);
create index if not exists consents_candidate_idx
  on public.consents (subject_candidate_id) where subject_candidate_id is not null;

-- R2. Allowed versions (single source of truth on the DB side; must match
--     src/lib/consent/versions.ts, checked by tests/consent.test.ts).
create or replace function public.consent_version_allowed(
  p_consent_type text, p_notice_version text, p_terms_version text, p_checkbox_version text)
returns boolean
language sql immutable
set search_path = ''
as $$
  select p_notice_version = 'campus-privacy-v0.4'
     and p_checkbox_version in (
           select base || '-' || lang
           from (values
                   ('privacy_terms_abroad',        'campus-consent-v0.3'),
                   ('partner_individual_progress', 'campus-consent-partner-v0.3'),
                   ('share_employer',              'campus-consent-employer-v0.3')) v(t, base)
           cross join (values ('he'), ('am'), ('ru')) l(lang)
           where v.t = p_consent_type)
     and case when p_consent_type = 'privacy_terms_abroad'
              then p_terms_version is not distinct from 'campus-terms-beta-v0.4'
              else p_terms_version is null end;
$$;

-- R3. Guard: append-only; the only UPDATE allowed is the FK SET NULL erasure
--     (stamps subject_erased_at); DELETE / TRUNCATE only for service_role
--     with app.erasure = 'on' (retention purge).
create or replace function public.consents_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.user_id is null and new.subject_candidate_id is null then
      raise exception 'consents: a subject (user_id or subject_candidate_id) is required';
    end if;
    new.created_at := clock_timestamp();  -- server time; strictly ordered within a transaction
    new.subject_erased_at := null;
    return new;
  elsif tg_op = 'UPDATE' then
    if (to_jsonb(new) - 'user_id' - 'subject_candidate_id' - 'subject_erased_at')
         = (to_jsonb(old) - 'user_id' - 'subject_candidate_id' - 'subject_erased_at')
       and (new.user_id is null or new.user_id = old.user_id)
       and (new.subject_candidate_id is null or new.subject_candidate_id = old.subject_candidate_id)
       and (new.user_id is distinct from old.user_id
            or new.subject_candidate_id is distinct from old.subject_candidate_id) then
      if new.user_id is null and new.subject_candidate_id is null then
        new.subject_erased_at := coalesce(old.subject_erased_at, now());
      else
        new.subject_erased_at := old.subject_erased_at;
      end if;
      return new;
    end if;
    raise exception 'consents is append-only';
  else -- DELETE / TRUNCATE
    if current_user = 'service_role'
       and coalesce(current_setting('app.erasure', true), '') = 'on' then
      if tg_op = 'DELETE' then return old; end if;
      return null;
    end if;
    raise exception 'consents: % only via service_role with app.erasure=on', lower(tg_op);
  end if;
end;
$$;
drop trigger if exists consents_guard on public.consents;
create trigger consents_guard
  before insert or update or delete on public.consents
  for each row execute function public.consents_guard();
drop trigger if exists consents_guard_truncate on public.consents;
create trigger consents_guard_truncate
  before truncate on public.consents
  for each statement execute function public.consents_guard();

-- R4. Server-side write path (service_role, SECURITY INVOKER: service_role
--     bypasses RLS; clients have no INSERT any more).
create or replace function public.record_consent(
  p_user_id uuid,
  p_subject_candidate_id uuid,
  p_consent_type text,
  p_granted boolean,
  p_notice_version text,
  p_terms_version text,
  p_checkbox_version text,
  p_language text,
  p_channel text,
  p_evidence jsonb)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_pseudo uuid;
  v_id uuid;
begin
  if not public.consent_version_allowed(p_consent_type, p_notice_version, p_terms_version, p_checkbox_version) then
    raise exception 'consent version not allowed' using errcode = '22023';
  end if;
  select c.subject_pseudonym into v_pseudo
    from public.consents c
   where (p_user_id is not null and c.user_id = p_user_id)
      or (p_subject_candidate_id is not null and c.subject_candidate_id = p_subject_candidate_id)
   order by c.created_at
   limit 1;
  insert into public.consents (user_id, subject_candidate_id, subject_pseudonym, consent_type, granted,
                               notice_version, terms_version, checkbox_version, language, channel, evidence)
  values (p_user_id, p_subject_candidate_id, coalesce(v_pseudo, gen_random_uuid()), p_consent_type, p_granted,
          p_notice_version, p_terms_version, p_checkbox_version, p_language, p_channel, coalesce(p_evidence, '{}'::jsonb))
  returning id into v_id;
  return v_id;
end;
$$;

-- R5. Server-side enforcement: does the user hold the CURRENT required consent?
create or replace function public.consent_ok(p_user_id uuid)
returns boolean
language sql stable
security invoker
set search_path = ''
as $$
  select coalesce((
    select c.granted
       and public.consent_version_allowed(c.consent_type, c.notice_version, c.terms_version, c.checkbox_version)
      from public.consents c
     where c.user_id = p_user_id and c.consent_type = 'privacy_terms_abroad'
     order by c.created_at desc
     limit 1), false);
$$;

-- R6. Retention purge (life + 3 years, see header).
create or replace function public.purge_expired_consents()
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare n integer;
begin
  perform set_config('app.erasure', 'on', true);
  delete from public.consents c
   where exists (select 1 from public.consents s
                  where s.subject_pseudonym = c.subject_pseudonym
                    and s.consent_type = c.consent_type
                    and s.created_at > c.created_at
                    and s.created_at < now() - interval '3 years')
      or (c.subject_erased_at is not null and c.subject_erased_at < now() - interval '3 years');
  get diagnostics n = row_count;
  perform set_config('app.erasure', 'off', true);
  return n;
end;
$$;

do $$ begin perform cron.unschedule('consents-retention-purge'); exception when others then null; end $$;
select cron.schedule('consents-retention-purge', '17 3 * * *',
  $cron$ set role service_role; select public.purge_expired_consents(); $cron$);

-- R7. Policies: no client INSERT (server path only); reads unchanged.
drop policy if exists consents_insert_own on public.consents;

-- R8. Explicit grants (minimum; replaces the grants above).
--   anon:          nothing
--   authenticated: SELECT (own rows / staff via policies)
--   service_role:  SELECT, INSERT (record_consent), DELETE (retention purge,
--                  still blocked by the guard unless app.erasure = 'on')
--   functions: service_role only; consents_guard(): nobody (trigger only)
revoke all on public.consents from public, anon, authenticated, service_role;
grant select on public.consents to authenticated;
grant select, insert, delete on public.consents to service_role;
revoke all on function public.consents_guard() from public, anon, authenticated, service_role;
revoke all on function public.consent_version_allowed(text, text, text, text) from public, anon, authenticated;
revoke all on function public.record_consent(uuid, uuid, text, boolean, text, text, text, text, text, jsonb) from public, anon, authenticated;
revoke all on function public.consent_ok(uuid) from public, anon, authenticated;
revoke all on function public.purge_expired_consents() from public, anon, authenticated;
grant execute on function public.consent_version_allowed(text, text, text, text) to service_role;
grant execute on function public.record_consent(uuid, uuid, text, boolean, text, text, text, text, text, jsonb) to service_role;
grant execute on function public.consent_ok(uuid) to service_role;
grant execute on function public.purge_expired_consents() to service_role;

-- =====================================================================
-- R9. Security re-review (2026-11-01). Re-runnable.
-- =====================================================================
-- R9a. More channels (offline / assisted consent), each with its evidence.
alter table public.consents drop constraint if exists consents_channel_check;
alter table public.consents add constraint consents_channel_check
  check (channel in ('web', 'whatsapp', 'telegram', 'paper', 'phone'));
alter table public.consents drop constraint if exists consents_evidence_check;
alter table public.consents add constraint consents_evidence_check check (
  jsonb_typeof(evidence) = 'object' and
  case channel
    when 'web'      then evidence ? 'ip_hash' and evidence ? 'user_agent'
    when 'whatsapp' then evidence ? 'message_id' and evidence ? 'template'
    when 'telegram' then evidence ? 'message_id' and evidence ? 'template'
    when 'paper'    then evidence ? 'document_ref' and evidence ? 'recorded_by'
    when 'phone'    then evidence ? 'call_ref' and evidence ? 'recorded_by'
  end);

-- R9b. The guard also rejects unknown versions on INSERT (not only record_consent).
create or replace function public.consents_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.user_id is null and new.subject_candidate_id is null then
      raise exception 'consents: a subject (user_id or subject_candidate_id) is required';
    end if;
    if not public.consent_version_allowed(new.consent_type, new.notice_version, new.terms_version, new.checkbox_version) then
      raise exception 'consents: version not allowed' using errcode = '22023';
    end if;
    new.created_at := clock_timestamp();  -- server time; strictly ordered within a transaction
    new.subject_erased_at := null;
    return new;
  elsif tg_op = 'UPDATE' then
    if (to_jsonb(new) - 'user_id' - 'subject_candidate_id' - 'subject_erased_at')
         = (to_jsonb(old) - 'user_id' - 'subject_candidate_id' - 'subject_erased_at')
       and (new.user_id is null or new.user_id = old.user_id)
       and (new.subject_candidate_id is null or new.subject_candidate_id = old.subject_candidate_id)
       and (new.user_id is distinct from old.user_id
            or new.subject_candidate_id is distinct from old.subject_candidate_id) then
      if new.user_id is null and new.subject_candidate_id is null then
        new.subject_erased_at := coalesce(old.subject_erased_at, now());
      else
        new.subject_erased_at := old.subject_erased_at;
      end if;
      return new;
    end if;
    raise exception 'consents is append-only';
  else -- DELETE / TRUNCATE
    if current_user = 'service_role'
       and coalesce(current_setting('app.erasure', true), '') = 'on' then
      if tg_op = 'DELETE' then return old; end if;
      return null;
    end if;
    raise exception 'consents: % only via service_role with app.erasure=on', lower(tg_op);
  end if;
end;
$$;
revoke all on function public.consents_guard() from public, anon, authenticated, service_role;
-- the guard runs as the inserting role (service_role); it needs the checker
grant execute on function public.consent_version_allowed(text, text, text, text) to service_role;

-- R9c. consent_ok for RLS (CTO 2026-11-01): SECURITY DEFINER (reads consents
--      as the owner, no RLS recursion), STABLE, search_path ''. A caller can
--      ask only about itself, unless staff or no end-user JWT (server).
create or replace function public.consent_ok(p_user_id uuid)
returns boolean
language sql stable
security definer
set search_path = ''
as $$
  select case
    when (select auth.uid()) is not null
         and p_user_id is distinct from (select auth.uid())
         and not public.is_staff() then false
    else coalesce((
      select c.granted
         and public.consent_version_allowed(c.consent_type, c.notice_version, c.terms_version, c.checkbox_version)
        from public.consents c
       where c.user_id = p_user_id and c.consent_type = 'privacy_terms_abroad'
       order by c.created_at desc
       limit 1), false)
  end;
$$;
revoke all on function public.consent_ok(uuid) from public, anon;
grant execute on function public.consent_ok(uuid) to authenticated, service_role;

-- R9d. Student writes require the CURRENT consent (RLS). Staff / teacher
--      writes are unchanged: the consent term is OR-ed with a staff/teacher
--      check, so those roles keep exactly their previous rights.
--      Covered: community posts (insert/update), comments, community-media
--      uploads, feedback, contact messages; exam results via a trigger
--      (written by the SECURITY DEFINER grade_exam_attempt RPC, which RLS
--      does not see). Attendance has no student write path (teacher/owner only).
drop policy if exists "Members create posts in own class" on public.community_posts;
create policy "Members create posts in own class" on public.community_posts for insert to authenticated
with check (
  author_id = (select auth.uid())
  and ((select public.consent_ok((select auth.uid())))
       or public.has_role((select auth.uid()), 'owner'::public.app_role)
       or public.has_role((select auth.uid()), 'staff'::public.app_role)
       or public.has_role((select auth.uid()), 'teacher'::public.app_role))
  and (
    (post_type = any (array['post'::public.community_post_type, 'question'::public.community_post_type])
      and (class_id = public.current_user_class_id()
           or public.has_role((select auth.uid()), 'owner'::public.app_role)
           or public.has_role((select auth.uid()), 'staff'::public.app_role)
           or exists (select 1 from public.classes cl where cl.id = community_posts.class_id and cl.teacher_id = (select auth.uid()))))
    or (post_type = 'announcement'::public.community_post_type
      and (public.has_role((select auth.uid()), 'owner'::public.app_role)
           or public.has_role((select auth.uid()), 'staff'::public.app_role)
           or exists (select 1 from public.classes cl where cl.id = community_posts.class_id and cl.teacher_id = (select auth.uid()))))
  )
);

drop policy if exists "Author or owner update post" on public.community_posts;
create policy "Author or owner update post" on public.community_posts for update to authenticated
using (
  (author_id = (select auth.uid())
   and ((select public.consent_ok((select auth.uid())))
        or public.has_role((select auth.uid()), 'staff'::public.app_role)
        or public.has_role((select auth.uid()), 'teacher'::public.app_role)))
  or public.has_role((select auth.uid()), 'owner'::public.app_role)
);

drop policy if exists "Insert comment when post visible" on public.community_comments;
create policy "Insert comment when post visible" on public.community_comments for insert to authenticated
with check (
  author_id = (select auth.uid())
  and ((select public.consent_ok((select auth.uid())))
       or public.has_role((select auth.uid()), 'owner'::public.app_role)
       or public.has_role((select auth.uid()), 'staff'::public.app_role)
       or public.has_role((select auth.uid()), 'teacher'::public.app_role))
  and exists (select 1 from public.community_posts p where p.id = community_comments.post_id)
);

drop policy if exists "Author inserts own feedback" on public.feedback_reports;
create policy "Author inserts own feedback" on public.feedback_reports for insert to authenticated
with check (
  author_id = (select auth.uid())
  and ((select public.consent_ok((select auth.uid())))
       or public.has_role((select auth.uid()), 'owner'::public.app_role)
       or public.has_role((select auth.uid()), 'staff'::public.app_role)
       or public.has_role((select auth.uid()), 'teacher'::public.app_role))
);

drop policy if exists "Authenticated insert contact" on public.contact_messages;
create policy "Authenticated insert contact" on public.contact_messages for insert to authenticated
with check (
  sender_id = (select auth.uid())
  and ((select public.consent_ok((select auth.uid())))
       or public.has_role((select auth.uid()), 'owner'::public.app_role)
       or public.has_role((select auth.uid()), 'staff'::public.app_role)
       or public.has_role((select auth.uid()), 'teacher'::public.app_role))
);

drop policy if exists "Authenticated upload to own folder" on storage.objects;
create policy "Authenticated upload to own folder" on storage.objects for insert to authenticated
with check (
  bucket_id = 'community-media'
  and (storage.foldername(name))[1] = ((select auth.uid()))::text
  and ((select public.consent_ok((select auth.uid())))
       or public.has_role((select auth.uid()), 'owner'::public.app_role)
       or public.has_role((select auth.uid()), 'staff'::public.app_role)
       or public.has_role((select auth.uid()), 'teacher'::public.app_role))
);

-- exam results: written by grade_exam_attempt (SECURITY DEFINER) -> trigger.
create or replace function public.exam_results_consent_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare v_uid uuid := (select auth.uid());
begin
  if v_uid is not null and new.user_id = v_uid
     and not public.consent_ok(v_uid)
     and not public.has_role(v_uid, 'owner'::public.app_role)
     and not public.has_role(v_uid, 'staff'::public.app_role)
     and not public.has_role(v_uid, 'teacher'::public.app_role) then
    raise exception 'current consent required' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function public.exam_results_consent_guard() from public, anon, authenticated, service_role;
drop trigger if exists exam_results_consent_guard on public.exam_results;
create trigger exam_results_consent_guard before insert or update on public.exam_results
  for each row execute function public.exam_results_consent_guard();
