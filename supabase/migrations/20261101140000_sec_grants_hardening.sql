-- fix/sec-grants-hardening: client roles (anon, authenticated) never need
-- TRUNCATE, REFERENCES or TRIGGER on public tables. TRUNCATE bypasses RLS.
-- Revokes them on every existing public table/view/matview and from the
-- default privileges for future objects created by postgres. Re-runnable;
-- no data changes. service_role is unchanged.
do $$
declare r record;
begin
  for r in
    select n.nspname, c.relname
      from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind in ('r', 'p', 'v', 'm', 'f')
  loop
    execute format('revoke truncate, references, trigger on table %I.%I from anon, authenticated',
                   r.nspname, r.relname);
  end loop;
end $$;

alter default privileges for role postgres in schema public
  revoke truncate, references, trigger on tables from anon, authenticated;

-- Round 5: PostgreSQL 17 added the MAINTAIN privilege (VACUUM, ANALYZE,
-- CLUSTER, REFRESH MATERIALIZED VIEW, REINDEX, LOCK TABLE). Client roles never
-- need it. Only on server_version_num >= 170000 (the keyword does not exist
-- before 17). Re-runnable.
do $$
declare r record;
begin
  if current_setting('server_version_num')::int >= 170000 then
    for r in
      select n.nspname, c.relname
        from pg_class c join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'public' and c.relkind in ('r', 'p', 'v', 'm', 'f')
    loop
      execute format('revoke maintain on table %I.%I from anon, authenticated', r.nspname, r.relname);
    end loop;
    execute 'alter default privileges for role postgres in schema public revoke maintain on tables from anon, authenticated';
  end if;
end $$;
