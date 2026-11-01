-- fix/sec-grants-hardening: no TRUNCATE/REFERENCES/TRIGGER for client roles.
-- Run ONLY against a local / branch DB as postgres; rolled back at the end.
begin;
do $$
declare n int; t text;
begin
  select count(*) into n
    from pg_class c join pg_namespace ns on ns.oid = c.relnamespace,
         unnest(array['anon', 'authenticated']) rl, unnest(array['TRUNCATE', 'REFERENCES', 'TRIGGER']) p
   where ns.nspname = 'public' and c.relkind in ('r', 'p', 'v', 'm', 'f')
     and has_table_privilege(rl, c.oid, p);
  if n <> 0 then raise exception 'FAIL T1: % client TRUNCATE/REFERENCES/TRIGGER grants remain', n; end if;
  raise notice 'PASS T1 no client truncate/references/trigger on public tables';

  -- T2: a table created later by postgres does not inherit them
  create table public.zz_grants_probe(id int);
  if has_table_privilege('anon', 'public.zz_grants_probe', 'TRUNCATE')
     or has_table_privilege('authenticated', 'public.zz_grants_probe', 'TRUNCATE')
     or has_table_privilege('authenticated', 'public.zz_grants_probe', 'TRIGGER')
     or has_table_privilege('authenticated', 'public.zz_grants_probe', 'REFERENCES') then
    raise exception 'FAIL T2: default privileges still grant'; end if;
  raise notice 'PASS T2 default privileges';

  -- T3: service_role untouched where it had TRUNCATE
  select count(*) into n from pg_class c join pg_namespace ns on ns.oid = c.relnamespace
   where ns.nspname = 'public' and c.relkind = 'r' and has_table_privilege('service_role', c.oid, 'SELECT')
     and not has_table_privilege('service_role', c.oid, 'TRUNCATE');
  raise notice 'INFO T3 service_role tables without truncate: %', n;

  -- T4: TRUNCATE as authenticated fails
  select relname into t from pg_class c join pg_namespace ns on ns.oid = c.relnamespace
   where ns.nspname = 'public' and c.relkind = 'r' and c.relname <> 'zz_grants_probe' limit 1;
  execute 'set local role authenticated';
  begin
    execute format('truncate public.%I', t);
    raise exception 'FAIL T4 truncate succeeded on %', t;
  exception when insufficient_privilege then raise notice 'PASS T4 truncate denied (%)', t;
  end;
  execute 'reset role';
end $$;
rollback;
