-- fix/beta-no-id-medical-docs (CTO-approved, round 5): public.raw_biometric_log
-- becomes server-write-only. Clients (anon, authenticated) lose INSERT, UPDATE
-- and DELETE; the student INSERT policy is dropped (every known name, incl. the
-- consent-gated re-creation from feat/consent-record #11, migration 120400).
-- authenticated SELECT grant and SELECT policies are left as they are (anon
-- loses SELECT; TRUNCATE/REFERENCES/TRIGGER/MAINTAIN revoked; RLS FORCEd); the table is
-- NOT dropped. service_role (server) keeps/gets explicit SELECT/INSERT/
-- UPDATE/DELETE (it bypasses RLS).
-- Sorts after 20260925120400 (#11), 20261101130000 (#10) and 20261101140000
-- (#15, which only revokes TRUNCATE/REFERENCES/TRIGGER/MAINTAIN and grants
-- nothing), so no later migration re-grants these privileges.
-- Re-runnable; no data is touched.
do $$
declare p record;
begin
  if to_regclass('public.raw_biometric_log') is null then
    return;
  end if;
  revoke insert, update, delete on table public.raw_biometric_log from anon, authenticated;
  -- Round 6: anon loses SELECT; no client DDL-ish privileges; RLS forced.
  revoke select on table public.raw_biometric_log from anon;
  revoke truncate, references, trigger on table public.raw_biometric_log from anon, authenticated;
  if current_setting('server_version_num')::int >= 170000 then
    execute 'revoke maintain on table public.raw_biometric_log from anon, authenticated';
  end if;
  alter table public.raw_biometric_log force row level security;
  -- Server path stays explicit (post-2026-10-30 projects no longer auto-grant).
  grant select, insert, update, delete on table public.raw_biometric_log to service_role;
  -- Drop every client INSERT/ALL policy (covers 'Students insert own bio log'
  -- and any renamed variant); SELECT/UPDATE/DELETE policies stay (no grant now
  -- for client UPDATE/DELETE, so those are inert for clients).
  for p in
    select policyname from pg_policies
    where schemaname = 'public' and tablename = 'raw_biometric_log'
      and cmd in ('INSERT', 'ALL')
      and (roles && array['authenticated', 'anon', 'public']::name[])
  loop
    execute format('drop policy if exists %I on public.raw_biometric_log', p.policyname);
  end loop;
end $$;
drop policy if exists "Students insert own bio log" on public.raw_biometric_log;
-- CTO decision (round 6): teachers get NO access to biometric/medical data.
-- Drop the original teacher SELECT policy and #4's rewritten variant.
drop policy if exists "Teachers view their students bio log" on public.raw_biometric_log;
drop policy if exists raw_bio_teacher_select on public.raw_biometric_log;
