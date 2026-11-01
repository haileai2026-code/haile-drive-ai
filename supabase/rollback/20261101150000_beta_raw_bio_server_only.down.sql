-- Rollback for 20261101150000_beta_raw_bio_server_only.sql. Run manually.
-- Restores client INSERT/UPDATE/DELETE grants for authenticated (anon is NOT
-- re-granted) and the student INSERT policy: the consent-gated form
-- (feat/consent-record #11) when public.consent_ok() exists, else the main form.
do $$
begin
  if to_regclass('public.raw_biometric_log') is null then
    return;
  end if;
  grant insert, update, delete on table public.raw_biometric_log to authenticated;
  drop policy if exists "Students insert own bio log" on public.raw_biometric_log;
  if to_regprocedure('public.consent_ok(uuid)') is not null then
    create policy "Students insert own bio log" on public.raw_biometric_log for insert to authenticated
    with check (
      student_id = (select auth.uid())
      and public.current_user_has_beqa_access()
      and (select public.consent_ok((select auth.uid())))
    );
  else
    create policy "Students insert own bio log" on public.raw_biometric_log for insert to authenticated
    with check (student_id = auth.uid() and public.current_user_has_beqa_access());
  end if;
end $$;
