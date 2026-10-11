-- =====================================================================
-- fix/sec-candidates-rls
-- Source of truth: haile-architecture/fix-sec-candidates-rls-SPEC.sql (S2, 2026-09-25).
-- Sections 1-7 are taken verbatim from the spec; section 8 adds the teacher
-- roster RPC (CTO decision: teachers get NO table access to public.candidates).
--
-- DRAFT: NOT applied to any database. Applying to cmvv = gate G2 (Sol).
-- No seed, no DELETE, no UPDATE of existing candidates rows. The only change
-- to public.candidates data shape is the new nullable column user_id.
-- =====================================================================
-- (No explicit BEGIN/COMMIT: the Supabase CLI already runs each migration in a transaction.)
-- ---------------------------------------------------------------------
-- 1. Helpers (single staff helper; no arguments -> no role enumeration)
-- ---------------------------------------------------------------------
create or replace function public.is_staff(_owner_only boolean default false)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.user_roles ur
    where ur.user_id = (select auth.uid())
      and (ur.role = 'owner'::public.app_role
           or (not _owner_only and ur.role = 'staff'::public.app_role))
  );
$$;
revoke all on function public.is_staff(boolean) from public, anon;
grant execute on function public.is_staff(boolean) to authenticated, service_role;

-- Stable student<->candidate link (replaces the user-editable email match).
alter table public.candidates add column if not exists user_id uuid unique
  references auth.users(id) on delete set null;
-- Backfill: auth.users = 0 today, so nothing to backfill. The import/pay flows in
-- src/lib/admin-users.functions.ts must set candidates.user_id (service role).

create or replace function public.current_candidate_id()
returns uuid
language sql stable security definer
set search_path = ''
as $$
  select c.id from public.candidates c
  where c.user_id = (select auth.uid())
  limit 1;
$$;
revoke all on function public.current_candidate_id() from public, anon;
grant execute on function public.current_candidate_id() to authenticated, service_role;

-- Rewrite existing helpers to use user_id (they currently trust profiles.email).
create or replace function public.current_user_class_id()
returns uuid language sql stable security definer set search_path = ''
as $$
  select c.class_id from public.candidates c
  where c.user_id = (select auth.uid()) limit 1;
$$;
create or replace function public.current_user_has_beqa_access()
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.candidates c
                 where c.user_id = (select auth.uid()) and c.beqa_access = true);
$$;
revoke all on function public.current_user_class_id() from public, anon;
revoke all on function public.current_user_has_beqa_access() from public, anon;
grant execute on function public.current_user_class_id() to authenticated, service_role;
grant execute on function public.current_user_has_beqa_access() to authenticated, service_role;

-- ---------------------------------------------------------------------
-- 2. Lock profiles.email (today any user can UPDATE their own email and thereby
--    (a) read a candidate row whose email matches, (b) be promoted to 'student'
--    by setCandidatePayment's email match). App never updates profiles.email.
-- ---------------------------------------------------------------------
revoke update on public.profiles from anon, authenticated;
grant update (full_name, language, updated_at) on public.profiles to authenticated;
-- (owner edits of is_active/phone/branch go through supabaseAdmin or add them here
--  if admin.users.tsx:59 must keep using the user client -> then grant is_active too
--  and rely on the "Owners update any profile" policy.)
grant update (is_active) on public.profiles to authenticated;  -- needed by admin.users.tsx:59
-- NOTE: with is_active grantable, add WITH CHECK so users cannot re-activate themselves:
drop policy if exists "Users update own profile" on public.profiles;
create policy profiles_self_update on public.profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid())
              and is_active = (select p.is_active from public.profiles p where p.id = (select auth.uid())));

-- ---------------------------------------------------------------------
-- 3. Enable + FORCE RLS
-- ---------------------------------------------------------------------
alter table public.candidates          enable row level security;
alter table public.candidates          force  row level security;
alter table public.candidate_documents enable row level security;
alter table public.candidate_documents force  row level security;
alter table public.notifications       enable row level security;
alter table public.notifications       force  row level security;
alter table public.schedule_events     enable row level security;
alter table public.schedule_events     force  row level security;

-- ---------------------------------------------------------------------
-- 4. Grants: nothing for anon; only DML for authenticated (RLS decides rows)
-- ---------------------------------------------------------------------
revoke all on public.candidates, public.candidate_documents,
              public.notifications, public.schedule_events from anon;
revoke all on public.candidates, public.candidate_documents,
              public.notifications, public.schedule_events from authenticated;
grant select, insert, update, delete on public.candidates, public.candidate_documents,
              public.notifications, public.schedule_events to authenticated;
grant all on public.candidates, public.candidate_documents,
              public.notifications, public.schedule_events to service_role;
-- Stop future tables from auto-granting anon (live default ACL grants anon arwdDxtm):
alter default privileges for role postgres in schema public revoke all on tables from anon;

-- ---------------------------------------------------------------------
-- 5. Drop existing policies (exact live names)
-- ---------------------------------------------------------------------
drop policy if exists "Owners delete candidates"        on public.candidates;
drop policy if exists "Owners insert candidates"        on public.candidates;
drop policy if exists "Owners view candidates"          on public.candidates;
drop policy if exists "Students view own candidate"     on public.candidates;   -- UNSAFE (email match)
drop policy if exists "Teachers view their candidates"  on public.candidates;   -- out of spec (staff/admin only)
drop policy if exists "Owners update candidates"        on public.candidates;   -- no WITH CHECK

drop policy if exists "Owners delete docs"                  on public.candidate_documents;
drop policy if exists "Owners staff insert docs"            on public.candidate_documents;
drop policy if exists "Owners staff view docs"              on public.candidate_documents;
drop policy if exists "Teachers view their candidate docs"  on public.candidate_documents;
drop policy if exists "Owners staff update docs"            on public.candidate_documents;

drop policy if exists "Owners delete notifications"         on public.notifications;
drop policy if exists "Owners staff insert notifications"   on public.notifications;
drop policy if exists "Owners staff view notifications"     on public.notifications;
drop policy if exists "Students view own notifications"     on public.notifications; -- UNSAFE (email match)
drop policy if exists "Owners staff update notifications"   on public.notifications;

drop policy if exists "Owners delete schedule"          on public.schedule_events;
drop policy if exists "Owners insert schedule"          on public.schedule_events;
drop policy if exists "Owners staff view schedule"      on public.schedule_events;
drop policy if exists "Students view own schedule"      on public.schedule_events; -- UNSAFE (email match)
drop policy if exists "Owners update schedule"          on public.schedule_events;
-- Teacher schedule policies are KEPT (class-based, no candidate PII exposure beyond event rows):
--   "Teachers insert their schedule", "Teachers view their schedule", "Teachers update their schedule"

-- ---------------------------------------------------------------------
-- 6. New policies (one per command)
-- ---------------------------------------------------------------------
-- candidates: staff read; owner write; NO student / teacher / anon access
create policy candidates_staff_select on public.candidates for select to authenticated
  using ((select public.is_staff()));
create policy candidates_owner_insert on public.candidates for insert to authenticated
  with check ((select public.is_staff(true)));
create policy candidates_owner_update on public.candidates for update to authenticated
  using ((select public.is_staff(true))) with check ((select public.is_staff(true)));
create policy candidates_owner_delete on public.candidates for delete to authenticated
  using ((select public.is_staff(true)));

-- candidate_documents: staff read/insert/update/delete (matches today's owner+staff)
create policy cand_docs_staff_select on public.candidate_documents for select to authenticated
  using ((select public.is_staff()));
create policy cand_docs_staff_insert on public.candidate_documents for insert to authenticated
  with check ((select public.is_staff()) and uploaded_by = (select auth.uid()));
create policy cand_docs_staff_update on public.candidate_documents for update to authenticated
  using ((select public.is_staff())) with check ((select public.is_staff()));
create policy cand_docs_staff_delete on public.candidate_documents for delete to authenticated
  using ((select public.is_staff()));

-- notifications: staff read/insert/update; owner delete; student reads own via stable link
create policy notif_staff_select on public.notifications for select to authenticated
  using ((select public.is_staff()));
create policy notif_student_select_own on public.notifications for select to authenticated
  using (candidate_id is not null and candidate_id = (select public.current_candidate_id()));
create policy notif_staff_insert on public.notifications for insert to authenticated
  with check ((select public.is_staff()));
create policy notif_staff_update on public.notifications for update to authenticated
  using ((select public.is_staff())) with check ((select public.is_staff()));
create policy notif_owner_delete on public.notifications for delete to authenticated
  using ((select public.is_staff(true)));

-- schedule_events: staff read/insert/update; owner delete; student reads own + own class
create policy sched_staff_select on public.schedule_events for select to authenticated
  using ((select public.is_staff()));
create policy sched_student_select_own on public.schedule_events for select to authenticated
  using ( (candidate_id is not null and candidate_id = (select public.current_candidate_id()))
       or (class_id is not null and class_id = (select public.current_user_class_id())) );
create policy sched_staff_insert on public.schedule_events for insert to authenticated
  with check ((select public.is_staff()));
create policy sched_staff_update on public.schedule_events for update to authenticated
  using ((select public.is_staff())) with check ((select public.is_staff()));
create policy sched_owner_delete on public.schedule_events for delete to authenticated
  using ((select public.is_staff(true)));

-- ---------------------------------------------------------------------
-- 7. Storage: bucket 'candidate-documents' (private) -> staff only via helper
-- ---------------------------------------------------------------------
drop policy if exists "Owners staff read candidate docs"   on storage.objects;
drop policy if exists "Owners staff upload candidate docs" on storage.objects;
drop policy if exists "Owners staff update candidate docs" on storage.objects;
drop policy if exists "Owners staff delete candidate docs" on storage.objects;
drop policy if exists "Teachers view candidate doc files"  on storage.objects;
create policy cand_docs_obj_select on storage.objects for select to authenticated
  using (bucket_id = 'candidate-documents' and (select public.is_staff()));
create policy cand_docs_obj_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'candidate-documents' and (select public.is_staff()));
create policy cand_docs_obj_update on storage.objects for update to authenticated
  using (bucket_id = 'candidate-documents' and (select public.is_staff()))
  with check (bucket_id = 'candidate-documents' and (select public.is_staff()));
create policy cand_docs_obj_delete on storage.objects for delete to authenticated
  using (bucket_id = 'candidate-documents' and (select public.is_staff()));

-- ---------------------------------------------------------------------
-- 8. Teacher roster (teachers have no table access to public.candidates).
--    Returns only candidates in classes the caller teaches
--    (public.classes.teacher_id = auth.uid(), same rule as the kept
--    "Teachers ... their schedule" policies) and only non-PII columns:
--    no phone / email / notes / national_id / documents.
-- ---------------------------------------------------------------------
create or replace function public.get_teacher_roster()
returns table (
  id        uuid,
  full_name text,
  class_id  uuid,
  status    public.candidate_status
)
language sql stable security definer
set search_path = ''
as $$
  select c.id, c.full_name, c.class_id, c.status
  from public.candidates c
  join public.classes cl on cl.id = c.class_id
  where cl.teacher_id = (select auth.uid())
  order by c.full_name;
$$;
revoke all on function public.get_teacher_roster() from public, anon;
grant execute on function public.get_teacher_roster() to authenticated;


-- ---------------------------------------------------------------------
-- 9. CTO decision (2026-09-25): the remaining email-matching policies are
--    in scope. Students match on the stable link only (current_candidate_id()
--    for candidate-keyed tables, auth.uid() for user-keyed ones).
--    TODO(phone-otp): students who log in by phone OTP are NOT linked to
--    candidates.user_id by any flow yet; linking must be done by staff via
--    the import/admin flow. Do NOT add phone-based matching (phone login is
--    off for the closed beta).
-- ---------------------------------------------------------------------

-- Helper for teacher-addressed contact messages: does the caller teach the
-- class of the candidate linked to _student_user_id? SECURITY DEFINER because
-- teachers have no table access to public.candidates.
create or replace function public.teaches_student_user(_student_user_id uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.candidates c
    join public.classes cl on cl.id = c.class_id
    where c.user_id = _student_user_id
      and cl.teacher_id = (select auth.uid())
  );
$$;
revoke all on function public.teaches_student_user(uuid) from public, anon;
grant execute on function public.teaches_student_user(uuid) to authenticated, service_role;

drop policy if exists "Students view own attendance" on public.attendance_records;
create policy attendance_student_select_own on public.attendance_records for select to authenticated
  using (candidate_id = (select public.current_candidate_id()));

drop policy if exists "Students view own makeup" on public.makeup_assignments;
create policy makeup_student_select_own on public.makeup_assignments for select to authenticated
  using (candidate_id = (select public.current_candidate_id()));

drop policy if exists "Sender or admin reads contact" on public.contact_messages;
create policy contact_select on public.contact_messages for select to authenticated
  using (
    sender_id = (select auth.uid())
    or (select public.is_staff())
    or (recipient_role = 'teacher'::public.contact_recipient
        and public.teaches_student_user(sender_id))
  );

drop policy if exists "Admin or recipient updates contact" on public.contact_messages;
create policy contact_update on public.contact_messages for update to authenticated
  using (
    (select public.is_staff())
    or (recipient_role = 'teacher'::public.contact_recipient
        and public.teaches_student_user(sender_id))
  )
  with check (
    (select public.is_staff())
    or (recipient_role = 'teacher'::public.contact_recipient
        and public.teaches_student_user(sender_id))
  );
