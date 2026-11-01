# Merge order — haile-drive-ai open PRs (2026-11-01)

Verified: a combined merge of all branches **in exactly this order** on top of
`origin/main` (temp worktree, deleted afterwards) replays all migrations twice
(old auto-grant mode and post-2026-10-30 explicit-grant mode), passes all 7 SQL
test files, `bun test` (63 pass / 0 fail), `tsc`, `vite build` (no service-role
code in the client bundle) and `bun install --frozen-lockfile`.

## 1. Order

| # | PR | Branch | Depends on |
|---|----|--------|------------|
| 1 | #3  | fix/p1.1-config-toml-cmvv | — |
| 2 | #13 | chore/vercel-only-node22 | — |
| 3 | #4  | fix/sec-candidates-rls | — (provides `is_staff`, `is_teacher_user`, `candidates`) |
| 4 | #11 | feat/consent-record | #4 (already merged into the branch) |
| 5 | #5  | fix/sec-beqa-server-insert | #11 (merged into the branch: `requireCurrentConsent`) → #4 |
| 6 | #6  | fix/sec-otp-hardening | — (types.ts conflict, see below) |
| 7 | #9  | fix/sec-community-media-private | — |
| 8 | #8  | fix/p1.2-branding-cleanup | — |
| 9 | #7  | chore/i18n-string-inventory | — (docs only) |
| 10 | #10 | fix/beta-no-id-medical-docs | #4 (rollback form), #5 (shared flag file), #6 + #11 (conflicts) |
| 11 | #12 | fix/notifications-tick-url-config | — |
| 12 | #14 | p1.x-remove-community-refs | after #5/#10/#11 (overlapping areas) |

Notes
- #11 contains #4 (merge commits on the feature branch only). #5 contains #11
  (merge commit `f1cf525`), so GitHub shows those commits in #11/#5 until #4/#11
  are merged; merging in this order makes them disappear from the diffs.
- `src/lib/psych-assessments-flag.ts` is byte-identical on #5 and #10;
  `src/lib/client-ip.ts` is byte-identical on #6 and #11 (no conflict).
- Migrations are timestamp-ordered and independent of the merge order:
  `20260925120000` (#4) · `…120100` (#5) · `…120200` (#6) · `…120300` (#9) ·
  `…120400` (#11) · `20261101120000` (#12) · `20261101130000` (#10).

## 2. Known conflicts and exact resolutions

All are "keep both sides"; no logic has to be chosen.

| When merging | File | Why | Resolution |
|---|---|---|---|
| #6 (after #4/#11/#5) | `src/integrations/supabase/types.ts` | both add entries to `Functions` at the same spot (`is_staff`, `is_teacher_user`, `purge_expired_consents`, `record_consent` vs `phone_auth_user_lookup`, `phone_otp_*`) | keep both blocks (HEAD block then #6 block); it is a type map, order is irrelevant |
| #10 | `src/components/AppShell.tsx` | #11 wraps `<main>` content in `<ConsentGate>`; #10 adds the psych-route block | `<ConsentGate>{psychBlocked ? <div …>{PSYCH_ASSESSMENTS_DISABLED_MESSAGE}</div> : lockContent ? <LeadLockScreen /> : children}</ConsentGate>` |
| #10 | `src/lib/phone-login.functions.ts` (2 hunks: `requestPhoneOtp`, `verifyPhoneOtp`) | #6 rewrote the handlers; #10 adds the beta guard at the top | keep #6's body and put #10's line first: `if (!BETA_FEATURES.phoneOtpLogin) throw new Error(PHONE_LOGIN_DISABLED);` then `const phone = normalizePhoneE164(data.phone); …`. Drop #10's copy of the old `normalizePhone` lines. |
| #10 | `src/routes/profile.tsx` | import lines next to each other (`ConsentWithdrawal` from #11, `BETA_FEATURES` from #10) | keep both imports |
| (resolved inside #5) | `src/lib/diagnostics/finish-diagnostic.functions.ts` | #11 added `requireCurrentConsent` import, #5 added `supabaseAdmin` import | already resolved in the #5 merge commit `f1cf525` (both imports); no conflict when merging in this order |

No other conflicts. If GitHub's "Update branch" is used instead, resolve the same way.

## 3. Post-merge checks (each step and at the end)
1. `bun install --frozen-lockfile`, `bunx tsc --noEmit`, `bun test`, `bun run build`.
2. `rg -l SUPABASE_SERVICE_ROLE_KEY .output/public` → no output.
3. `git checkout src/routeTree.gen.ts` if the build regenerated it.
4. Replay all migrations on a fresh **Supabase branch** (dry run) and run every
   `supabase/tests/*.test.sql` (each rolls back): all `PASS`, the
   `SKIP I1` in `sec_candidates_rls` is expected once #10 is in.
5. Check the cron jobs: `notifications-tick` is scheduled only if both Vault
   secrets exist (else `select public.notifications_tick_schedule();` later);
   `consents-retention-purge` exists.

## 4. G2 prerequisites (before applying to cmvv)
| Item | Owner |
|---|---|
| `pg_dump --schema-only` snapshot of policies + grants **before** apply = the real rollback (the `.down.sql` files are best effort) | **CTO** |
| `OTP_PEPPER` and `CONSENT_EVIDENCE_PEPPER` set in the server env, each ≥ 32 random chars (no values in the repo) | **CTO** |
| Confirm `postgres` can `SET ROLE service_role` inside pg_cron on cmvv (used by `consents-retention-purge`) | **CTO** |
| Dry run on a Supabase branch first (section 3) | ops |
| CAPTCHA before phone login / Twilio is enabled (not needed for the closed beta) | dev |
| Vault secrets `notifications_tick_url`, `notifications_tick_secret` + `CRON_SECRET` | ops |
| Beta flags stay off: `VITE_BETA_PSYCH_ASSESSMENTS`, `VITE_BETA_SENSITIVE_FEATURES`, DB `app.beta_psych_assessments` | CTO decision |

## 5. Follow-ups
- **#9**: after legacy `community_posts.media_url` values (full public URLs) are
  migrated to object paths, run
  `alter table public.community_posts validate constraint community_posts_media_in_author_folder;`
  (the CHECK is `NOT VALID` until then; new/updated rows are already enforced).
- #5: `/beqa-spike` client insert; Marvad client practice scores (CTO decision).
- #4: UI for `linkCandidateUser`.
- #11: consent gates on course enrollment / lesson progress (not in the CTO list).
