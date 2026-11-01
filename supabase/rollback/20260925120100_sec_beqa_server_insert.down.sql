-- Grants rollback for 20260925120100_sec_beqa_server_insert.sql (explicit grants only).
-- Revokes the grants the migration adds; does not restore the dropped student
-- write policies or the old default grants. Run manually; re-runnable.
revoke select, delete on public.beqa_diagnostic_sessions from authenticated;
revoke select, insert, update, delete on public.beqa_diagnostic_sessions from service_role;
