-- Rollback for 20260925120410_course_enrollment_progress.sql (re-runnable).
drop trigger if exists trg_course_enrollments_guard on public.course_enrollments;
drop function if exists public.course_enrollments_guard();
drop function if exists public.recompute_course_progress(uuid);
drop policy if exists "enrollments own update" on public.course_enrollments;
create policy "enrollments own update" on public.course_enrollments for update to authenticated
using (student_id = auth.uid() or public.has_role(auth.uid(),'owner') or public.has_role(auth.uid(),'staff'))
with check (student_id = auth.uid() or public.has_role(auth.uid(),'owner') or public.has_role(auth.uid(),'staff'));
