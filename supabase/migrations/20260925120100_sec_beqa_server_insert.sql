-- =====================================================================
-- fix/sec-beqa-server-insert  (plan C2)
-- Students must not be able to write their own BEQA scores. All writes to
-- public.beqa_diagnostic_sessions now go through server functions that grade
-- on the server and insert with the service role (BYPASSRLS):
--   src/lib/diagnostics/finish-diagnostic.functions.ts   (unified diagnostic)
--   src/lib/diagnostics/beqa-submit.functions.ts         (psych + marvad)
--
-- DRAFT: NOT applied to any database. Applying to cmvv = gate G2 (Sol).
-- No data is changed or deleted; only policies and grants.
-- =====================================================================

-- 1. Drop every student write policy (current live names + legacy names).
drop policy if exists "student can insert beqa"                     on public.beqa_diagnostic_sessions;
drop policy if exists "student can update own in-progress session"  on public.beqa_diagnostic_sessions;
drop policy if exists "Students insert own sessions"                on public.beqa_diagnostic_sessions;
drop policy if exists "Students update own sessions"                on public.beqa_diagnostic_sessions;
drop policy if exists "beqa access control"                         on public.beqa_diagnostic_sessions;

-- 2. Grants: no client role may INSERT/UPDATE at all (REST insert -> 401/403).
--    SELECT (staff policy) and DELETE (owner policy) remain governed by RLS.
revoke all on public.beqa_diagnostic_sessions from anon;
revoke insert, update on public.beqa_diagnostic_sessions from authenticated;
grant select, delete on public.beqa_diagnostic_sessions to authenticated;
grant all on public.beqa_diagnostic_sessions to service_role;

-- Kept unchanged: "staff reads all beqa" (SELECT owner/staff/teacher) and
-- "owners delete beqa" (DELETE owner). There is intentionally NO student
-- SELECT policy, so students cannot read their own scores (plan C3).

-- 3. Explicit grants (Supabase breaking change 2026-10-30). This migration
--    creates no tables, views, functions or sequences in public; it pins the
--    minimum grants on the existing table so they no longer depend on the
--    (old, over-broad) default privileges. Re-runnable. Rollback (grants only):
--    supabase/rollback/20260925120100_sec_beqa_server_insert.down.sql
--    anon: nothing. authenticated: SELECT (staff policy) + DELETE (owner
--    policy) only - also drops TRUNCATE/REFERENCES/TRIGGER from the old ALL.
--    service_role: DML used by the server functions (insert/select; update/
--    delete for admin tooling), no TRUNCATE/REFERENCES/TRIGGER.
revoke all on public.beqa_diagnostic_sessions from anon, authenticated, service_role;
grant select, delete on public.beqa_diagnostic_sessions to authenticated;
grant select, insert, update, delete on public.beqa_diagnostic_sessions to service_role;

-- 4. beqa_pulse_clicks (security round 3, N4): server-side writes only.
--    finishDiagnostic writes the clicks with service_role; the dev-only
--    /beqa-spike page no longer writes from the browser. Students keep
--    reading their own clicks ("student read own pulse clicks"). No data
--    changed. Re-runnable. (feat/consent-record's migration 120400 runs
--    after this one and re-creates the insert policy ONLY if it still
--    exists, so the combined state has no student insert policy.)
drop policy if exists "student insert own pulse clicks" on public.beqa_pulse_clicks;
revoke all on public.beqa_pulse_clicks from anon, authenticated;
grant select on public.beqa_pulse_clicks to authenticated;
grant select, insert, update, delete on public.beqa_pulse_clicks to service_role;
