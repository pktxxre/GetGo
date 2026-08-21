-- 011_photos_storage.sql — the `photos` storage bucket and its RLS.
--
-- Posts require a photo (create_post, CLAUDE.md), but nothing yet gave uploads a home: the
-- feed works only because seed rows store full picsum URLs (photos.ts passthrough). A real
-- post uploads its image here and stores the object key in post_photos.storage_path.
--
-- Object key convention: `{user_id}/{post_id}/{idx}.{ext}`. The first path segment is the
-- owner's uuid, which is what the insert policy checks — a signed-in user can only write
-- under their own prefix, so no one can plant a photo in someone else's post. RLS on
-- storage.objects is not optional here for the same reason it isn't on any table.

insert into storage.buckets (id, name, public)
values ('photos', 'photos', true)
on conflict (id) do nothing;

-- Public read: the feed is world-readable (a cold TikTok visitor sees photos with no account),
-- and post *rows* are already gated by can_view_post on post_photos — the image bytes behind a
-- private post are obscure-by-key, not secret, which matches a public CDN bucket. (A private
-- post's photo URL is unguessable; hardening it to per-object auth is a later, separate job.)
create policy "photos public read"
  on storage.objects for select
  using (bucket_id = 'photos');

-- Owner insert: an authenticated user may only write under their own uuid prefix.
create policy "photos owner insert"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Owner delete: lets a client clean up an orphaned upload (post insert failed after the photo
-- landed). Same own-prefix gate as insert.
create policy "photos owner delete"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
