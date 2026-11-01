-- feat/consent-record round 4 (R4-1): course_enrollments self-update hardening.
-- * "enrollments own update" requires current consent for the student.
-- * Students can no longer set status / progress_pct / completed_at (or move
--   the row: course_id / student_id / enrolled_at) directly; a BEFORE UPDATE
--   trigger rejects those changes unless they come from owner/staff, the
--   server (service_role / postgres) or the SECURITY DEFINER function
--   public.recompute_course_progress(), which derives the values from
--   course_lesson_progress. Re-runnable; no data changes.

drop policy if exists "enrollments own update" on public.course_enrollments;
create policy "enrollments own update" on public.course_enrollments for update to authenticated
using (
  (student_id = (select auth.uid()) and (select public.consent_ok((select auth.uid()))))
  or public.has_role((select auth.uid()), 'owner'::public.app_role)
  or public.has_role((select auth.uid()), 'staff'::public.app_role)
)
with check (
  (student_id = (select auth.uid()) and (select public.consent_ok((select auth.uid()))))
  or public.has_role((select auth.uid()), 'owner'::public.app_role)
  or public.has_role((select auth.uid()), 'staff'::public.app_role)
);

create or replace function public.course_enrollments_guard()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  -- current_user is the definer (postgres) inside recompute_course_progress,
  -- service_role on the server path; only direct client updates are checked.
  if current_user in ('authenticated', 'anon')
     and not (public.has_role(auth.uid(), 'owner'::public.app_role)
              or public.has_role(auth.uid(), 'staff'::public.app_role)) then
    if new.status is distinct from old.status
       or new.progress_pct is distinct from old.progress_pct
       or new.completed_at is distinct from old.completed_at
       or new.course_id is distinct from old.course_id
       or new.student_id is distinct from old.student_id
       or new.enrolled_at is distinct from old.enrolled_at then
      raise exception 'course_enrollments: progress fields are server-computed'
        using errcode = '42501';
    end if;
  end if;
  return new;
end $$;
revoke all on function public.course_enrollments_guard() from public, anon, authenticated;

drop trigger if exists trg_course_enrollments_guard on public.course_enrollments;
create trigger trg_course_enrollments_guard before update on public.course_enrollments
  for each row execute function public.course_enrollments_guard();

create or replace function public.recompute_course_progress(p_enrollment_id uuid)
returns numeric
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  uid uuid := auth.uid();
  e public.course_enrollments%rowtype;
  total int; done int; pct numeric;
begin
  select * into e from public.course_enrollments where id = p_enrollment_id;
  if not found then raise exception 'not found' using errcode = '42501'; end if;
  if not ((e.student_id = uid and public.consent_ok(uid))
          or public.has_role(uid, 'owner'::public.app_role)
          or public.has_role(uid, 'staff'::public.app_role)) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  select count(*) into total from public.course_lessons l
    join public.course_modules m on m.id = l.module_id where m.course_id = e.course_id;
  select count(*) into done from public.course_lesson_progress p
    join public.course_lessons l on l.id = p.lesson_id
    join public.course_modules m on m.id = l.module_id
   where p.enrollment_id = e.id and p.status = 'completed' and m.course_id = e.course_id;
  pct := case when total > 0 then round(done * 100.0 / total) else 0 end;
  update public.course_enrollments
     set progress_pct = pct,
         status = case when pct >= 100 then 'completed'::public.course_enrollment_status
                       else 'active'::public.course_enrollment_status end,
         completed_at = case when pct >= 100 then coalesce(e.completed_at, now()) else null end
   where id = e.id;
  return pct;
end $$;
revoke all on function public.recompute_course_progress(uuid) from public, anon;
grant execute on function public.recompute_course_progress(uuid) to authenticated, service_role;
