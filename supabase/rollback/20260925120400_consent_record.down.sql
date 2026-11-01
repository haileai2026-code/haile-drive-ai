-- Grants rollback for 20260925120400_consent_record.sql (explicit grants only).
-- Revokes the grants the migration adds and unschedules the retention purge.
-- It does not drop public.consents or its columns (consent history must not
-- be deleted). Run manually; re-runnable.
do $$ begin perform cron.unschedule('consents-retention-purge'); exception when others then null; end $$;
revoke select on public.consents from authenticated;
revoke select, insert, delete on public.consents from service_role;
revoke execute on function public.consent_version_allowed(text, text, text, text) from service_role;
revoke execute on function public.record_consent(uuid, uuid, text, boolean, text, text, text, text, text, jsonb) from service_role;
revoke execute on function public.consent_ok(uuid) from service_role;
revoke execute on function public.purge_expired_consents() from service_role;

-- R9 (security re-review): restore the pre-consent student write policies,
-- drop the exam_results consent trigger, and remove authenticated EXECUTE.
drop trigger if exists exam_results_consent_guard on public.exam_results;
drop function if exists public.exam_results_consent_guard();
revoke execute on function public.consent_ok(uuid) from authenticated;

drop policy if exists "Members create posts in own class" on public.community_posts;
create policy "Members create posts in own class" on public.community_posts for insert to authenticated
with check (
  author_id = auth.uid()
  and (
    (post_type = any (array['post'::public.community_post_type, 'question'::public.community_post_type])
      and (class_id = public.current_user_class_id()
           or public.has_role(auth.uid(), 'owner'::public.app_role)
           or public.has_role(auth.uid(), 'staff'::public.app_role)
           or exists (select 1 from public.classes cl where cl.id = community_posts.class_id and cl.teacher_id = auth.uid())))
    or (post_type = 'announcement'::public.community_post_type
      and (public.has_role(auth.uid(), 'owner'::public.app_role)
           or public.has_role(auth.uid(), 'staff'::public.app_role)
           or exists (select 1 from public.classes cl where cl.id = community_posts.class_id and cl.teacher_id = auth.uid())))
  )
);
drop policy if exists "Author or owner update post" on public.community_posts;
create policy "Author or owner update post" on public.community_posts for update to authenticated
using ((author_id = auth.uid()) or public.has_role(auth.uid(), 'owner'::public.app_role));
drop policy if exists "Insert comment when post visible" on public.community_comments;
create policy "Insert comment when post visible" on public.community_comments for insert to authenticated
with check ((author_id = auth.uid()) and (exists (select 1 from public.community_posts p where p.id = community_comments.post_id)));
drop policy if exists "Author inserts own feedback" on public.feedback_reports;
create policy "Author inserts own feedback" on public.feedback_reports for insert to authenticated
with check (author_id = auth.uid());
drop policy if exists "Authenticated insert contact" on public.contact_messages;
create policy "Authenticated insert contact" on public.contact_messages for insert to authenticated
with check (sender_id = auth.uid());
drop policy if exists "Authenticated upload to own folder" on storage.objects;
create policy "Authenticated upload to own folder" on storage.objects for insert to authenticated
with check ((bucket_id = 'community-media') and ((storage.foldername(name))[1] = (auth.uid())::text));
-- R9e (round 3): restore the previous student write policies.
drop policy if exists "Students insert own bio log" on public.raw_biometric_log;
create policy "Students insert own bio log" on public.raw_biometric_log for insert to authenticated
with check (student_id = auth.uid() and public.current_user_has_beqa_access());
do $$
begin
  if exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'beqa_pulse_clicks'
               and policyname = 'student insert own pulse clicks') then
    drop policy "student insert own pulse clicks" on public.beqa_pulse_clicks;
    create policy "student insert own pulse clicks" on public.beqa_pulse_clicks for insert to authenticated
      with check (student_id = auth.uid());
  end if;
end $$;
drop policy if exists "student inserts own consent" on public.biometric_consents;
create policy "student inserts own consent" on public.biometric_consents for insert to authenticated
with check (student_id = auth.uid());
drop policy if exists "enrollments own insert" on public.course_enrollments;
create policy "enrollments own insert" on public.course_enrollments for insert to authenticated
with check (student_id = auth.uid() and (public.has_role(auth.uid(),'student') or public.has_role(auth.uid(),'owner') or public.has_role(auth.uid(),'staff'))
  and exists (select 1 from public.online_courses c where c.id = course_id and c.status = 'published'));
drop policy if exists "lesson progress own all" on public.course_lesson_progress;
create policy "lesson progress own all" on public.course_lesson_progress for all to authenticated
using (exists (select 1 from public.course_enrollments e where e.id = enrollment_id
  and (e.student_id = auth.uid() or public.has_role(auth.uid(),'owner') or public.has_role(auth.uid(),'staff'))))
with check (exists (select 1 from public.course_enrollments e where e.id = enrollment_id
  and (e.student_id = auth.uid() or public.has_role(auth.uid(),'owner') or public.has_role(auth.uid(),'staff'))));
