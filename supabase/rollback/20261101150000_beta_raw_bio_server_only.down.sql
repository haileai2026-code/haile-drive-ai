-- Rollback for 20261101150000_beta_raw_bio_server_only.sql. Run manually.
-- Restores client INSERT/UPDATE/DELETE grants for authenticated (anon is NOT
-- re-granted), the teacher SELECT policy, and the student INSERT policy: the consent-gated form
-- (feat/consent-record #11) when public.consent_ok() exists, else the main form.
do $$
begin
  if to_regclass('public.raw_biometric_log') is null then
    return;
  end if;
  grant insert, update, delete on table public.raw_biometric_log to authenticated;
  -- Round 6 undo: NO FORCE RLS; re-grant anon SELECT (present on the
  -- auto-grant baseline). TRUNCATE/REFERENCES/TRIGGER/MAINTAIN are NOT
  -- re-granted (#15 revokes them independently).
  alter table public.raw_biometric_log no force row level security;
  grant select on table public.raw_biometric_log to anon;
  drop policy if exists "Students insert own bio log" on public.raw_biometric_log;
  -- Restore teacher SELECT: #4's rewritten form when its helper exists, else original.
  drop policy if exists raw_bio_teacher_select on public.raw_biometric_log;
  drop policy if exists "Teachers view their students bio log" on public.raw_biometric_log;
  if to_regprocedure('public.teaches_student_user(uuid)') is not null then
    create policy raw_bio_teacher_select on public.raw_biometric_log for select to authenticated
      using (public.teaches_student_user(student_id));
  else
    create policy "Teachers view their students bio log" on public.raw_biometric_log for select to authenticated
      using (exists (select 1 from public.candidates c
                     where c.id = raw_biometric_log.student_id and c.assigned_teacher_id = auth.uid()));
  end if;
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
