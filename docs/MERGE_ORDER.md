# Merge order — haile-drive-ai open PRs (2026-11-01, security round 5)

Verified (2026-11-01, after security round 5; heads #4 `7fa356d`, #6 `98bab69`, #11 `1b80e7e`,
#15 `87c29f4`, #10 `0316183`, #14 this PR, #16 `3e549d6`): a combined merge of the first 13 branches
(#3 … #14) **in exactly this order** on top of `origin/main` (temp worktree,
deleted afterwards) replays all migrations and re-runs this round's
migrations twice in each grant mode (old auto-grant mode, and explicit-grant
mode where legacy tables keep their existing grants and only objects created
by this round's migrations get none), passes all 11 `*.test.sql` files (plus
the read-only `check_client_grants.sql` from #15), `bun test` (76 pass /
0 fail), `tsc`, `vite build` (no service-role / pepper / Turnstile secret
names in `.output/public`) and `bun install --frozen-lockfile`. #16 is not
part of the combined test (added after it). OTP global-cap race
(190 sent + 50 parallel, slow send, some failures): ≤ 10 slots granted, never
above 200; failed sends release their slot. Conflicts were exactly those in
section 2 (#10: AppShell/profile; #6: types.ts/phone-login.functions.ts).

> **Truly clean explicit-grant bootstrap (no grants on legacy tables) is NOT
> green yet** — tracked as **HB-08 (P1)** in [`docs/BACKLOG_R5.md`](BACKLOG_R5.md);
> not a merge blocker. Legacy tables need explicit GRANTs before a project runs
> in explicit mode.

> **Apply migrations ONLY from merged `main`.** #11 and #5 carry an older copy
> of #4's migration (merge commits on their branches); never apply migrations
> from a feature branch. After all merges, `main` holds the final version.

> **Phone login is HARD-DISABLED in code (R5-1, #6).** `phoneLoginEnabled()`
> always returns false (403) regardless of env; `PHONE_LOGIN_ENABLED` /
> `TURNSTILE_SECRET_KEY` have no effect until a separate Turnstile siteverify
> PR lands (HB-01 = #16; see [`docs/BACKLOG_R5.md`](BACKLOG_R5.md)). No client CAPTCHA token is read today.
> **#10 must be merged before #6 is
> deployed.** Interim DB limits: 3/phone/15 min, 10/IP/h, 200 SMS/h
> (reserved+sent, under a global lock), 1000 request rows/h overall. A request
> without a client IP is refused with 400 in production (`VERCEL=1` or
> `NODE_ENV=production`); in dev all IP-less requests share one bucket, so the
> per-IP limit is never disabled.
> R4-4 (documented, follow-up): no alert yet when the SMS / row caps are hit.
> #15 (round 5): also revokes MAINTAIN on PG17+; re-run
> `supabase/tests/check_client_grants.sql` after every migration (a later
> `grant all` re-adds the privileges).

## 1. Order

| # | PR | Branch | Depends on |
|---|----|--------|------------|
| 1 | #3  | fix/p1.1-config-toml-cmvv | — |
| 2 | #13 | chore/vercel-only-node22 | — |
| 3 | #4  | fix/sec-candidates-rls | — (provides `is_staff`, `is_teacher_user`, `candidates`) |
| 4 | #15 | fix/sec-grants-hardening | after #4 (revokes TRUNCATE/REFERENCES/TRIGGER from client roles; its migration sorts after every other PR's table-creating migration, so it covers their tables; it grants nothing) |
| 5 | #11 | feat/consent-record | #4 (already merged into the branch) |
| 6 | #5  | fix/sec-beqa-server-insert | #11 (merged into the branch: `requireCurrentConsent`) → #4 |
| 7 | #10 | fix/beta-no-id-medical-docs | #4 (rollback form), #5 (shared flag file), #11 (conflicts). **Before #6.** |
| 8 | #6  | fix/sec-otp-hardening | #10 must be merged before #6 is deployed |
| 9 | #9  | fix/sec-community-media-private | — |
| 10 | #8  | fix/p1.2-branding-cleanup | — |
| 11 | #7  | chore/i18n-string-inventory | — (docs only) |
| 12 | #12 | fix/notifications-tick-url-config | — |
| 13 | #14 | p1.x-remove-community-refs | after #5/#10/#11/#6 (overlapping areas) |
| 14 | #16 | feat/hb-01-turnstile-siteverify | #6 (HB-01 server-side Turnstile siteverify for phone OTP) |

Core security chain (Security's final order): **#4 → #15 → #11 → #5 → #10 → #6 → #14 → #16**
(#3, #13 first; #9, #8, #7, #12 between #6 and #14 as listed).

Notes
- #11 contains #4 and #5 contains #11 (merge commits on the feature branches
  only); merging in this order makes them disappear from the diffs. Their copy
  of #4's migration is older — apply only from merged main (see above).
- `src/lib/psych-assessments-flag.ts` is byte-identical on #5 and #10;
  `src/lib/client-ip.ts` and `tests/client-ip.test.ts` are byte-identical on
  #6 and #11, no conflict.
- `beqa_pulse_clicks`: #5 (120100) drops the student INSERT policy and client
  write grants; #11 (120400) re-creates it with `consent_ok` **only if it still
  exists**, so the combined state has no student insert policy.
- #11 round 4 (120410): student `course_enrollments` updates need `consent_ok`;
  `status` / `progress_pct` / `completed_at` are server-computed by
  `recompute_course_progress()` (guard trigger rejects direct student writes).
- `raw_biometric_log` (round 5, #10 `20261101150000`): server-write-only.
  Revokes INSERT/UPDATE/DELETE from anon/authenticated, drops every client
  INSERT policy (incl. #11's consent-gated `Students insert own bio log`),
  keeps SELECT, grants service_role explicitly. Sorts after #11 (120400),
  #10 (130000) and #15 (140000), so nothing re-grants. **#11's
  `consent_record.test.sql` N-block must expect the bio-log insert denied in
  every consent state once #10 is in** (section 2). The client insert in
  `src/routes/diagnostics.tsx` (psych flow, beta flag off) now fails by design —
  move it to a server function before the flag is enabled.
- Migrations are timestamp-ordered and independent of the merge order:
  `20260925120000` (#4) · `…120100` (#5) · `…120200` (#6) · `…120300` (#9) ·
  `…120400`, `…120410` (#11) · `20261101120000` (#12) · `20261101130000` (#10) ·
  `20261101140000` (#15) · `20261101150000` (#10, round 5).
- Round 6 (#10 `0316183`, same migration `20261101150000`): FORCE RLS on
  `raw_biometric_log`, anon loses SELECT, TRUNCATE/REFERENCES/TRIGGER (+MAINTAIN
  on PG17) revoked, and **(CTO) teachers get no access**: both
  `"Teachers view their students bio log"` and #4's `raw_bio_teacher_select`
  are dropped. #4's `sec_candidates_rls.test.sql` I5b must then expect no
  teacher policy on `raw_biometric_log` (adjustment in
  #4 at `7fa356d`, check I5c); with it the combined merge passes
  all SQL tests in both grant modes.

## 2. Known conflicts and exact resolutions

All are "keep both sides"; no logic has to be chosen.

| When merging | File | Why | Resolution |
|---|---|---|---|
| #10 (after #4/#15/#11/#5) | `src/components/AppShell.tsx` | #11 wraps `<main>` content in `<ConsentGate>`; #10 adds the psych-route block | `<ConsentGate>{psychBlocked ? <div …>{PSYCH_ASSESSMENTS_DISABLED_MESSAGE}</div> : lockContent ? <LeadLockScreen /> : children}</ConsentGate>` |
| #10 | `src/routes/profile.tsx` | adjacent imports (`ConsentWithdrawal` #11, `BETA_FEATURES` #10) | keep both imports |
| #6 (after #10) | `src/integrations/supabase/types.ts` | both sides add `Functions` entries at the same spot | keep both blocks (HEAD then #6); type map, order irrelevant |
| #6 (after #10) | `src/lib/phone-login.functions.ts` (2 hunks: `requestPhoneOtp`, `verifyPhoneOtp`) | #10 added the beta guard to the old handlers; #6 rewrote them | keep #10's guard line first, then #6's body: `if (!BETA_FEATURES.phoneOtpLogin) throw new Error(PHONE_LOGIN_DISABLED);` `assertPhoneLoginEnabled();` `const phone = normalizePhoneE164(data.phone); …`. Drop #10's old `normalizePhone` lines. |
| #10 (after #11/#5) | `supabase/tests/consent_record.test.sql` (no textual conflict) | #10's 150000 drops the student bio-log insert policy, so N2 (`current:bio_log`) fails | next to `pulse` add `bio boolean := exists (… tablename = 'raw_biometric_log' and policyname = 'Students insert own bio log')`; record the result under key `case when bio then '' else 'denied_' end \|\| st \|\| ':bio_log'`, so with the policy absent the insert must be **denied in all states** (stricter, not weaker). Commit on `main` right after merging #10 (or on #11 before merge) |
| (resolved inside #5) | `src/lib/diagnostics/finish-diagnostic.functions.ts` | both add imports | already resolved in #5's merge commit `f1cf525` |

No other conflicts. If GitHub's "Update branch" is used instead, resolve the same way.

## 3. Post-merge checks (each step and at the end)
1. `bun install --frozen-lockfile`, `bunx tsc --noEmit`, `bun test`, `bun run build`.
2. `rg -l SUPABASE_SERVICE_ROLE_KEY .output/public` → no output.
3. `git checkout src/routeTree.gen.ts` if the build regenerated it.
4. Replay all migrations **from merged main** on a fresh **Supabase branch**
   (dry run) and run every `supabase/tests/*.test.sql` (each rolls back): all
   `PASS`; `SKIP I1` in `sec_candidates_rls` is expected once #10 is in.
5. Cron jobs: `notifications-tick` is scheduled only if both Vault secrets
   exist (else `select public.notifications_tick_schedule();` later);
   `consents-retention-purge` exists.

## 4. G2 checklist (before applying to cmvv)
| Item | Owner |
|---|---|
| Apply migrations **only from merged `main`** (never from a feature branch; #11/#5 carry an older #4 migration) | ops |
| `pg_dump --schema-only` snapshot of policies + grants **before** apply = the real rollback (the `.down.sql` files are best effort) | **CTO** |
| `OTP_PEPPER` and `CONSENT_EVIDENCE_PEPPER` set in the server env, each ≥ 32 random chars (no values in the repo) | **CTO** |
| Confirm `postgres` can `SET ROLE service_role` inside pg_cron on cmvv (used by `consents-retention-purge`) | **CTO** |
| #4 migration's one data UPDATE: one-off backfill/re-sync of `candidates.assigned_teacher_id` to the class teacher (stale rows only). Review the affected row count on the dry run; covered by the snapshot | **CTO** |
| #9: after legacy `community_posts.media_url` values are migrated to object paths, run `alter table public.community_posts validate constraint community_posts_media_in_author_folder;` (CHECK is `NOT VALID` until then) | ops |
| Phone login is hard-disabled in code; enabling needs the separate Turnstile siteverify PR + client widget first (BACKLOG_R5 #1). #10 merged before #6 deploys | dev / product |
| After apply (and after every later migration): `check_client_grants.sql` PASS | ops |
| Dry run on a Supabase branch first (section 3) | ops |
| Client-IP source: Vercel sets `VERCEL=1` (only `x-vercel-forwarded-for`). `EDGE_PLATFORM=cloudflare` only if origin is Cloudflare-only; `TRUSTED_PROXY=on` only behind another proxy | ops |
| Vault secrets `notifications_tick_url`, `notifications_tick_secret` + `CRON_SECRET` | ops |
| Beta flags stay off: `VITE_BETA_PSYCH_ASSESSMENTS`, `VITE_BETA_SENSITIVE_FEATURES`, DB `app.beta_psych_assessments`, server `PHONE_LOGIN_ENABLED` | CTO decision |

## 5. Follow-ups
- R4-4: alert when SMS / request-row caps are hit (acceptable once Turnstile is in place).
- Round 5 backlog (CTO decisions): see [`docs/BACKLOG_R5.md`](BACKLOG_R5.md): Turnstile siteverify PR before `PHONE_LOGIN_ENABLED`; server-side lesson completion before certificates (#11 R5-2); `supabase_admin` default privileges (#15); reduce anon DML on legacy tables; bind pulse clicks to a server-created session (`finish-diagnostic.functions.ts:28/84`).
- #9: `VALIDATE CONSTRAINT` after legacy media URLs are migrated (see G2).
- #5: Marvad client practice scores (CTO decision).
- #4: UI for `linkCandidateUser`.
- HB-08 (P1) explicit GRANTs for legacy tables before explicit-grant mode; HB-09 `verifyPhoneOtp` pre-GA hardening — both in [`docs/BACKLOG_R5.md`](BACKLOG_R5.md).
