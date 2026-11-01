-- Rollback for 20261101140000_sec_grants_hardening.sql (best effort).
-- Restores TRUNCATE/REFERENCES/TRIGGER for client roles ONLY on tables where
-- the role still has SELECT (i.e. where the pre-migration auto-grant applied);
-- the authoritative rollback is the pre-apply pg_dump --schema-only snapshot.
-- NOTE: this down script can OVER-grant (it re-grants on every table where the
-- role has SELECT, even if the privilege was never granted there). Prefer the
-- pg_dump snapshot.
do $$
declare r record; rl text;
begin
  for r in
    select n.nspname, c.relname
      from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind in ('r', 'p', 'v', 'm', 'f')
  loop
    foreach rl in array array['anon', 'authenticated'] loop
      if has_table_privilege(rl, format('%I.%I', r.nspname, r.relname), 'SELECT') then
        execute format('grant truncate, references, trigger on table %I.%I to %I', r.nspname, r.relname, rl);
      end if;
    end loop;
  end loop;
end $$;
alter default privileges for role postgres in schema public
  grant truncate, references, trigger on tables to anon, authenticated;
do $$
declare r record; rl text;
begin
  if current_setting('server_version_num')::int >= 170000 then
    for r in
      select n.nspname, c.relname
        from pg_class c join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'public' and c.relkind in ('r', 'p', 'v', 'm', 'f')
    loop
      foreach rl in array array['anon', 'authenticated'] loop
        if has_table_privilege(rl, format('%I.%I', r.nspname, r.relname), 'SELECT') then
          execute format('grant maintain on table %I.%I to %I', r.nspname, r.relname, rl);
        end if;
      end loop;
    end loop;
    execute 'alter default privileges for role postgres in schema public grant maintain on tables to anon, authenticated';
  end if;
end $$;
