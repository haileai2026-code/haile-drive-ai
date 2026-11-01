-- fix/sec-community-media-private: bucket private, no anon read, member read rules.
-- Run ONLY against a local / branch DB as postgres; rolled back at the end.
begin;

do $$
declare
  u_owner uuid := '00000000-0000-0000-0000-00000000c001';
  u_other uuid := '00000000-0000-0000-0000-00000000c002';
  obj text := '00000000-0000-0000-0000-00000000c001/11111111-1111-1111-1111-111111111111.jpg';
  n int;
begin
  -- B1: bucket is private
  perform 1 from storage.buckets where id = 'community-media' and public = false;
  if not found then raise exception 'FAIL B1: community-media bucket is public'; end if;

  -- B2: no policy on storage.objects for anon/public mentions community-media
  select count(*) into n from pg_policies
   where schemaname = 'storage' and tablename = 'objects'
     and (roles @> array['anon']::name[] or roles @> array['public']::name[])
     and (coalesce(qual,'') ilike '%community-media%' or coalesce(with_check,'') ilike '%community-media%');
  if n <> 0 then raise exception 'FAIL B2: % anon/public policies on community-media', n; end if;

  insert into storage.objects(bucket_id, name, owner) values ('community-media', obj, u_owner);

  -- B3: anon cannot select objects
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  execute 'set local role anon';
  select count(*) into n from storage.objects where bucket_id = 'community-media';
  execute 'reset role';
  if n <> 0 then raise exception 'FAIL B3: anon can read community-media objects (%)', n; end if;

  -- B4: uploader can read own object
  perform set_config('request.jwt.claims', json_build_object('sub', u_owner, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  select count(*) into n from storage.objects where bucket_id = 'community-media';
  execute 'reset role';
  if n <> 1 then raise exception 'FAIL B4: uploader cannot read own object'; end if;

  -- B5: unrelated authenticated user without a referencing visible post cannot read
  perform set_config('request.jwt.claims', json_build_object('sub', u_other, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  select count(*) into n from storage.objects where bucket_id = 'community-media';
  execute 'reset role';
  if n <> 0 then raise exception 'FAIL B5: unrelated user can read object'; end if;

  -- B6: object referenced by an announcement (path form) is readable by members
  insert into public.community_posts(author_id, content, media_url, post_type)
    values (u_owner, 'x', obj, 'announcement');
  perform set_config('request.jwt.claims', json_build_object('sub', u_other, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  select count(*) into n from storage.objects where bucket_id = 'community-media';
  execute 'reset role';
  if n <> 1 then raise exception 'FAIL B6: announcement media not readable'; end if;

  -- B7: legacy full public URL form still matches
  update public.community_posts set media_url =
    'https://example.supabase.co/storage/v1/object/public/community-media/' || obj;
  execute 'set local role authenticated';
  select count(*) into n from storage.objects where bucket_id = 'community-media';
  execute 'reset role';
  if n <> 1 then raise exception 'FAIL B7: legacy URL no longer matches'; end if;

  -- B8: a partial path in a post does not unlock a different object
  update public.community_posts set media_url = '00000000-0000-0000-0000-00000000c001/';
  execute 'set local role authenticated';
  select count(*) into n from storage.objects where bucket_id = 'community-media';
  execute 'reset role';
  if n <> 0 then raise exception 'FAIL B8: substring match unlocked object'; end if;

  raise notice 'PASS sec_community_media_private';
end $$;

-- C: explicit grants (Supabase 2026-10-30). The migration creates no objects in
-- public; the read policy depends on existing objects - assert the app path.
do $$
begin
  if not has_table_privilege('authenticated', 'public.community_posts', 'SELECT') then raise exception 'FAIL C1 community_posts select'; end if;
  if not has_function_privilege('authenticated', 'public.current_user_class_id()', 'EXECUTE') then raise exception 'FAIL C2 current_user_class_id'; end if;
  if not has_function_privilege('authenticated', 'public.has_role(uuid, public.app_role)', 'EXECUTE') then raise exception 'FAIL C3 has_role'; end if;
  if not (has_table_privilege('authenticated', 'storage.objects', 'SELECT') and has_table_privilege('authenticated', 'storage.objects', 'INSERT')) then
    raise exception 'FAIL C4 storage.objects'; end if;
  raise notice 'PASS C explicit grants / app path';
end $$;

rollback;
