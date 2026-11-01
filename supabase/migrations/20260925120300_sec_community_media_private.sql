-- =====================================================================
-- fix/sec-community-media-private  (P1.2 B3)
--  * community-media bucket -> private (no public object URLs).
--  * drop the anonymous "Public read community media" SELECT policy.
--  * authenticated read = uploader (own folder), owner/staff/teacher (as
--    before), or a member who can see a post that references the object
--    (own class, or an announcement). The reference match is exact on the
--    stored object path, with legacy full public URLs of this bucket still
--    matched by suffix.
-- App: posts store the object path; the client renders 1 h signed URLs.
-- DRAFT: NOT applied to any database. Applying to cmvv = gate G2 (Sol).
-- No objects or rows are deleted or rewritten.
-- =====================================================================

update storage.buckets set public = false where id = 'community-media';

drop policy if exists "Public read community media" on storage.objects;

drop policy if exists "Community media read by uploader staff or classmates" on storage.objects;
create policy "Community media read by uploader staff or classmates"
on storage.objects
for select to authenticated
using (
  bucket_id = 'community-media'
  and (
    (storage.foldername(name))[1] = (select auth.uid())::text
    or public.has_role((select auth.uid()), 'owner'::public.app_role)
    or public.has_role((select auth.uid()), 'staff'::public.app_role)
    or public.has_role((select auth.uid()), 'teacher'::public.app_role)
    or exists (
      select 1 from public.community_posts p
      where p.media_url is not null
        -- review fix: a post only unlocks objects in its AUTHOR's folder, so
        -- a post cannot reference (and expose) someone else's upload.
        and (storage.foldername(storage.objects.name))[1] = p.author_id::text
        and (p.media_url = storage.objects.name
             or p.media_url like '%/storage/v1/object/public/community-media/' || storage.objects.name)
        and (p.class_id = public.current_user_class_id()
             or p.post_type = 'announcement'::public.community_post_type)
    )
  )
);

-- Review fix (CTO 2026-11-01): DB CHECK - media_url is null or a path in the
-- author's own folder (no '..'). NOT VALID: enforced for every new / updated
-- row; legacy rows that still hold a full public URL are not rewritten
-- (validate after they are migrated: alter table public.community_posts
-- validate constraint community_posts_media_in_author_folder).
alter table public.community_posts drop constraint if exists community_posts_media_in_author_folder;
alter table public.community_posts add constraint community_posts_media_in_author_folder
  check (media_url is null
         or (left(media_url, length(author_id::text) + 1) = author_id::text || '/'
             and position('..' in media_url) = 0))
  not valid;

-- Upload (own folder) and delete (own folder) policies are unchanged:
--   "Authenticated upload to own folder", "Owner deletes own media".
