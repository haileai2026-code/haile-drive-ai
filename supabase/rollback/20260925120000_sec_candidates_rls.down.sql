-- Grants rollback for 20260925120000_sec_candidates_rls.sql (explicit grants only).
-- Revokes every GRANT the migration adds. It does NOT restore the old policies,
-- columns or the pre-migration (over-broad) grants. Run manually; re-runnable.
revoke execute on function public.is_staff(boolean)              from authenticated, service_role;
revoke execute on function public.current_candidate_id()         from authenticated, service_role;
revoke execute on function public.current_user_class_id()        from authenticated, service_role;
revoke execute on function public.current_user_has_beqa_access() from authenticated, service_role;
revoke execute on function public.get_teacher_roster()           from authenticated;
revoke execute on function public.teaches_student_user(uuid)     from authenticated, service_role;
revoke select, insert, update, delete on public.candidates, public.candidate_documents,
              public.notifications, public.schedule_events from authenticated, service_role;
revoke update (full_name, language, updated_at, is_active) on public.profiles from authenticated;
