-- Rollback for 20261101130000_beta_block_psych_and_docs.sql. Run manually.
-- Removes the psych write guard and restores the document INSERT policies
-- (fix/sec-candidates-rls form when public.is_staff() exists, else the original main form).
do $$
declare t text;
begin
  foreach t in array array['beqa_diagnostic_sessions', 'raw_biometric_log', 'beqa_pulse_clicks'] loop
    if to_regclass('public.' || t) is not null then
      execute format('drop trigger if exists beta_psych_write_guard on public.%I', t);
    end if;
  end loop;
end $$;
drop function if exists public.beta_psych_write_guard();

do $$
begin
  drop policy if exists cand_docs_staff_insert on public.candidate_documents;
  drop policy if exists "Owners staff insert docs" on public.candidate_documents;
  drop policy if exists cand_docs_obj_insert on storage.objects;
  drop policy if exists "Owners staff upload candidate docs" on storage.objects;
  if to_regprocedure('public.is_staff()') is not null then
    create policy cand_docs_staff_insert on public.candidate_documents for insert to authenticated
      with check ((select public.is_staff()) and uploaded_by = (select auth.uid()));
    create policy cand_docs_obj_insert on storage.objects for insert to authenticated
      with check (bucket_id = 'candidate-documents' and (select public.is_staff()));
  else
    create policy "Owners staff insert docs" on public.candidate_documents for insert to authenticated
      with check (public.has_role(auth.uid(), 'owner'::public.app_role) or public.has_role(auth.uid(), 'staff'::public.app_role));
    create policy "Owners staff upload candidate docs" on storage.objects for insert to authenticated
      with check (bucket_id = 'candidate-documents' and (public.has_role(auth.uid(), 'owner'::public.app_role) or public.has_role(auth.uid(), 'staff'::public.app_role)));
  end if;
end $$;
