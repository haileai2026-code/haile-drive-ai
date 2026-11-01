-- Grants rollback for 20260925120100_sec_beqa_server_insert.sql (explicit grants only).
-- Revokes the grants the migration adds; does not restore the dropped student
-- write policies or the old default grants. Run manually; re-runnable.
revoke select, delete on public.beqa_diagnostic_sessions from authenticated;
revoke select, insert, update, delete on public.beqa_diagnostic_sessions from service_role;
-- Section 4 (beqa_pulse_clicks, round 3): restore the student insert policy
-- and the client INSERT grant.
drop policy if exists "student insert own pulse clicks" on public.beqa_pulse_clicks;
create policy "student insert own pulse clicks" on public.beqa_pulse_clicks for insert to authenticated
  with check (student_id = auth.uid());
grant insert on public.beqa_pulse_clicks to authenticated;
