-- 023_delete_account.sql — self-serve account deletion (T9), invariant-preserving.
--
-- The hard rule (CLAUDE.md): deleting your account must NOT rewrite anyone else's history. The
-- FK graph makes a naive delete catastrophic — auth.users → users → posts/ratings/saves/xp_ledger
-- are all ON DELETE CASCADE. A cascade would hard-delete this user's posts (shifting every other
-- user's rarity and the ordinals stamped on posts that share a template) AND their ratings (which
-- are half of some other post's reception counts). So teardown is a TOMBSTONE, never a cascade:
--   - users: tombstoned_at = now() (RLS hides it, 001, so the byline disappears) + scrub PII
--     (handle/bio/avatar → NULL; nulling the handle also frees it for reuse).
--   - the user's posts: soft-delete (deleted_at) so they leave every feed, but the ROWS survive —
--     create_post counts include soft-deleted posts (007), so rarity + ordinals never shift.
--   - ratings/saves/xp_ledger: LEFT ALONE. The ratings are other posts' reception; the ledger is
--     append-only. Removing either rewrites someone else's history — the forbidden thing.
--   - auth.users: NOT deleted (that is the cascade trigger). Instead banned + PII scrubbed, so the
--     account can't sign back in and no personal data (email/phone/metadata) remains.
--
-- SECURITY DEFINER, caller-scoped: it only ever tears down auth.uid()'s own rows (no target
-- param, so no "delete someone else"), owned by postgres so it can reach auth.users. search_path
-- pinned empty like every definer function here.

create function public.delete_account() returns void
  language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'must be signed in to delete your account' using errcode = '42501';
  end if;

  -- Hide + anonymise the profile. RLS (users_public_read: tombstoned_at is null) makes the row
  -- vanish from every read, so bylines on other users' saved/redone quests go blank, not dangling.
  update public.users
     set tombstoned_at = now(),
         handle = null,
         bio = null,
         avatar_path = null
   where id = v_uid;

  -- Soft-delete the user's posts: gone from feeds, rows retained so counts don't move.
  update public.posts
     set deleted_at = now()
   where user_id = v_uid
     and deleted_at is null;

  -- Disable the login and scrub auth PII without deleting the row (a delete would cascade to
  -- posts). banned_until far in the future blocks any future sign-in; the email is replaced with
  -- a per-uid tombstone (unique, non-routable) so no real address remains and it can't collide.
  update auth.users
     set banned_until = 'infinity',
         email = 'deleted-' || v_uid::text || '@getgo.invalid',
         phone = null,
         raw_user_meta_data = '{}'::jsonb
   where id = v_uid;
end $$;

grant execute on function public.delete_account() to authenticated;
