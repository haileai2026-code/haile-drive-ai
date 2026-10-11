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
