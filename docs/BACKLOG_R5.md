# Backlog from Security round 5 (CTO decisions, 2026-11-01)

1. **Turnstile siteverify PR (before `PHONE_LOGIN_ENABLED`).** #6 hard-disables phone login in code. A separate PR must add: client widget (action `phone_otp`); server-side siteverify in `requestPhoneOtp` (token required, `TURNSTILE_SECRET_KEY` + `remoteip`, check `success`, `hostname` against an allowlist env such as `TURNSTILE_ALLOWED_HOSTNAMES`, `action = 'phone_otp'`, timeout, fail closed on any error); unit tests with mocked fetch; then restore the env gate. Only after that may `PHONE_LOGIN_ENABLED` be set.
2. **Server-side lesson completion before certificates (#11, R5-2).** Students can set `course_lesson_progress.status = 'completed'` themselves (accepted for beta). Move completion server-side (or block client-set `completed` with a trigger for non-service/non-staff) before any certificate depends on it.
3. **#15: default privileges for role `supabase_admin`.** If `supabase_admin` creates objects in `public`, also `alter default privileges for role supabase_admin in schema public revoke truncate, references, trigger[, maintain] on tables from anon, authenticated`.
4. **Reduce anon DML grants on legacy tables.** Revoke INSERT/UPDATE/DELETE from `anon` where no anonymous write path exists (RLS is the only barrier today).
5. **Bind pulse clicks to a server-created session (`src/lib/finish-diagnostic.functions.ts:28/84`).** Pulse clicks must reference a session id created server-side before the psych step, not a client-supplied id.

## HB-08 (P1) — explicit GRANTs for legacy tables before explicit-grant mode (not a merge blocker)

Reproduced 2026-11-01 on local PG17 with a **truly clean explicit-grant
bootstrap** (no default table privileges at any point, i.e. legacy tables
created by the Lovable-era migrations get no grants either), combined merge
#3 … #14 in merge order. Migrations replay fine (twice); 6 of 11 SQL test files
fail, all with `permission denied` on legacy tables:

| Test | Failure | Cause |
|---|---|---|
| `consent_record.test.sql` | `FAIL C3 write denied with current consent: current:post,current:comment,current:contact,current:feedback` | no INSERT grant for `authenticated` on `community_posts`, `community_comments`, `contact_messages`, `feedback_reports` |
| `sec_beqa_server_insert.test.sql` | `permission denied for table user_roles` | legacy `user_roles` (also `profiles`, `classes`) has no grants |
| `sec_candidates_rls.test.sql` | `permission denied for table profiles` | legacy `profiles` has no grants |
| `sec_community_media_private.test.sql` | `permission denied for table classes` | legacy `classes` has no grants |
| `beta_raw_bio_server_only.test.sql` | `permission denied for table raw_biometric_log` (authenticated SELECT of own rows) | legacy SELECT grant missing (the migration intentionally keeps SELECT as-is and does not add it) |

The earlier "explicit mode" run passed only because its bootstrap pre-granted
the legacy tables (old auto-grant until the first round migration), which
matches today's production projects but masks this gap.

Legacy `public` tables with client RLS policies but **no** grant to
`anon`/`authenticated` in clean explicit mode (policy commands in brackets):
`attendance_records` [SIUD], `cities` [SIUD], `classes` [SIUD],
`community_comments` [SID], `community_posts` [SIUD], `contact_messages`
[SIUD], `exam_options` [ALL,S], `exam_questions` [ALL,S], `exam_results`
[S,D], `exams` [SIUD], `feedback_reports` [SIUD], `makeup_assignments` [SIUD],
`materials` [SIUD], `profiles` [SIU], `raw_biometric_log` [S,D],
`teacher_assignments` [ALL,S], `user_roles` [SIUD], `voucher_tracking` [SIUD].
`service_role` has no SELECT on the same 17 legacy tables plus
`notifications_tick_state` (#12).

Fix (next round): one re-runnable migration with explicit, least-privilege
GRANTs per table matching the RLS policies (no anon DML unless a real anon
path exists — see item 4), plus `service_role` grants; run the test suite in
clean explicit mode in CI.

## HB-09 — `verifyPhoneOtp` pre-GA hardening

Before phone login goes GA (after #6 / #16): add a per-IP verify limit;
require Turnstile on verify after the first failed attempt; lock out per
phone **and** per IP (today the lockout is per phone only).

## HB-10 (P1, CTO-approved) — `diagnostics.tsx` must write `raw_biometric_log` via a server function

Since #10 (`20261101150000`) `raw_biometric_log` is server-write-only (no
client INSERT policy or grants), so the client insert in
`src/routes/diagnostics.tsx` (psych flow) fails by design. Move it to a
server function (service_role, `requireCurrentConsent`) **before the psych
assessments beta flag is enabled**.
