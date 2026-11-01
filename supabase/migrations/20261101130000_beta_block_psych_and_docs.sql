-- =====================================================================
-- fix/beta-no-id-medical-docs: closed-beta DB guards (CTO, 2026-11-01).
-- Re-runnable. Rollback: supabase/rollback/20261101130000_beta_block_psych_and_docs.down.sql
--
-- 1. Psychological assessments are blocked at the DB level while the beta
--    flag is off: every INSERT/UPDATE on beqa_diagnostic_sessions,
--    raw_biometric_log and beqa_pulse_clicks raises unless the database
--    setting app.beta_psych_assessments = 'on'. This holds for every role,
--    including the service role used by the server functions. Enable (human,
--    after the beta decision):
--      alter database postgres set app.beta_psych_assessments = 'on';
-- 2. ID / medical document upload is blocked on the server: the INSERT
--    policies on public.candidate_documents and on storage.objects for the
--    'candidate-documents' bucket are dropped (both the current names from
--    fix/sec-candidates-rls and the older names), so no client can upload.
--    Read / update / delete of existing documents is unchanged.
-- DRAFT: NOT applied to any database.
-- =====================================================================

-- 1. Psych assessment write guard
create or replace function public.beta_psych_write_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if coalesce(current_setting('app.beta_psych_assessments', true), '') <> 'on' then
    raise exception 'psych assessments are disabled in the closed beta'
      using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function public.beta_psych_write_guard() from public, anon, authenticated, service_role;

do $$
declare t text;
begin
  foreach t in array array['beqa_diagnostic_sessions', 'raw_biometric_log', 'beqa_pulse_clicks'] loop
    if to_regclass('public.' || t) is not null then
      execute format('drop trigger if exists beta_psych_write_guard on public.%I', t);
      execute format('create trigger beta_psych_write_guard before insert or update on public.%I
                      for each row execute function public.beta_psych_write_guard()', t);
    end if;
  end loop;
end $$;

-- 2. Document upload blocked (beta)
drop policy if exists cand_docs_staff_insert       on public.candidate_documents;
drop policy if exists "Owners staff insert docs"   on public.candidate_documents;
drop policy if exists cand_docs_obj_insert                  on storage.objects;
drop policy if exists "Owners staff upload candidate docs"  on storage.objects;
