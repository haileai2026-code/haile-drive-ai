-- =====================================================================
-- feat/consent-record
-- Append-only consent log (Campus Privacy Notice v0.4, Part C implementation
-- note): one row per checkbox decision. Latest row per (user, consent_type)
-- wins; withdrawal = a new row with granted = false. History is never
-- updated; rows are only removed when the auth user is erased (verified
-- deletion request -> ON DELETE CASCADE, or service role).
--
-- Depends on fix/sec-candidates-rls for public.is_staff().
-- DRAFT: NOT applied to any database. Applying to cmvv = gate G2 (Sol).
-- =====================================================================

create table if not exists public.consents (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null default auth.uid() references auth.users (id) on delete cascade,
  consent_type     text not null
                   check (consent_type in ('privacy_terms_abroad', 'partner_individual_progress', 'share_employer')),
  granted          boolean not null,
  notice_version   text not null check (length(notice_version) between 1 and 64),
  terms_version    text check (terms_version is null or length(terms_version) between 1 and 64),
  checkbox_version text not null check (length(checkbox_version) between 1 and 64),
  language         text not null check (language in ('he', 'am', 'ru')),
  created_at       timestamptz not null default now(),
  -- checkbox 1 (notice + terms + storage abroad) always records the terms version
  constraint consents_terms_version_for_checkbox1
    check (consent_type <> 'privacy_terms_abroad' or terms_version is not null)
);

create index if not exists consents_user_type_created_idx
  on public.consents (user_id, consent_type, created_at desc);

-- Server-side timestamp (clients cannot backdate) and no UPDATE, ever.
create or replace function public.consents_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    raise exception 'consents is append-only';
  end if;
  new.created_at := now();
  return new;
end;
$$;
drop trigger if exists consents_guard on public.consents;
create trigger consents_guard
  before insert or update on public.consents
  for each row execute function public.consents_guard();

alter table public.consents enable row level security;
alter table public.consents force row level security;

-- Grants: INSERT + SELECT only. No UPDATE / DELETE for any client role.
revoke all on public.consents from public, anon, authenticated;
grant select, insert on public.consents to authenticated;
grant all on public.consents to service_role;

drop policy if exists consents_insert_own on public.consents;
create policy consents_insert_own on public.consents
  for insert to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists consents_select_own on public.consents;
create policy consents_select_own on public.consents
  for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists consents_select_staff on public.consents;
create policy consents_select_staff on public.consents
  for select to authenticated
  using ((select public.is_staff()));

comment on table public.consents is
  'Append-only consent records (privacy notice / terms / checkbox versions). No UPDATE/DELETE for clients.';
