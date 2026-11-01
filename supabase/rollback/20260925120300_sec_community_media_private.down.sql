-- Rollback for 20260925120300_sec_community_media_private.sql. Run manually.
-- Restores the public bucket + public read policy and removes the CHECK.
alter table public.community_posts drop constraint if exists community_posts_media_in_author_folder;
drop policy if exists "Community media read by uploader staff or classmates" on storage.objects;
update storage.buckets set public = true where id = 'community-media';
drop policy if exists "Public read community media" on storage.objects;
create policy "Public read community media" on storage.objects
  for select using (bucket_id = 'community-media');
