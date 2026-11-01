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
