-- Read-only re-check (round 5): run after EVERY migration that may run
-- 'grant all' on public tables, since that re-adds TRUNCATE/REFERENCES/TRIGGER
-- (and MAINTAIN on PG17+) to anon/authenticated. Raises if any remain.
-- Usage: psql "$LOCAL_OR_BRANCH_DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/check_client_grants.sql
do $$
declare n int; privs text[] := array['TRUNCATE', 'REFERENCES', 'TRIGGER'];
begin
  if current_setting('server_version_num')::int >= 170000 then privs := privs || 'MAINTAIN'::text; end if;
  select count(*) into n
    from pg_class c join pg_namespace ns on ns.oid = c.relnamespace,
         unnest(array['anon', 'authenticated']) rl, unnest(privs) p
   where ns.nspname = 'public' and c.relkind in ('r', 'p', 'v', 'm', 'f')
     and has_table_privilege(rl, c.oid, p);
  if n <> 0 then raise exception 'FAIL check_client_grants: % client grants of % remain', n, privs; end if;
  raise notice 'PASS check_client_grants (%)', privs;
end $$;
