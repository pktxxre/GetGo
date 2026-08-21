-- 013_post_title.sql — a post carries its own quest name.
--
-- A first-of-its-kind post has no template yet, so it had nowhere to hold a title — the detail
-- screen read the title off the template only, leaving user posts nameless. The author names
-- the quest at post time; that name lands here and, when someone first saves the post, the
-- mint (015) copies it into the new quest_templates row. Nullable: naming stays optional at
-- compose, and the mint has a caption/generic fallback so the template's NOT NULL title always
-- resolves.

alter table public.posts
  add column title text;

-- A quest name is a short label, not prose (that's what caption is for). Bound it so a minted
-- template's title (and any UI that shows it) stays a title.
alter table public.posts
  add constraint posts_title_len
  check (title is null or char_length(title) between 1 and 80);
