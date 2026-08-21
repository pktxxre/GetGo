-- 015_mint_template.sql — mint a quest_template from a first-of-its-kind post on first save.
--
-- The core-loop unblock: a post with template_id = NULL is a dead end because saves target a
-- template (005). The first time someone saves such a post, this mints the template that lets
-- the quest propagate — "a quest template exists only once someone saves/redoes it" (CLAUDE.md).
-- The origin post is backfilled as the 1st completion, so rarity = count(posts on the template)
-- reads 1 immediately and climbs as others redo it later.
--
-- Lazy (minted on demand, not at post time), idempotent, and concurrency-safe: an advisory
-- xact lock on the post id serializes concurrent saves so exactly one template is minted. No
-- XP here — the post's flat award already landed at create_post; minting is not a new earning
-- event. SECURITY DEFINER (it writes quest_templates + posts regardless of the caller), so the
-- visibility guard is written inline: without it, a stranger could mint from a private post
-- they can't even see, because SECURITY DEFINER bypasses RLS.

create function public.mint_template_from_post(p_post_id uuid) returns uuid
  language plpgsql security definer set search_path = ''
as $$
declare
  v_uid      uuid := auth.uid();
  v_post     public.posts;
  v_title    text;
  v_slug     text;
  v_template uuid;
begin
  if v_uid is null then
    raise exception 'must be signed in to save' using errcode = '42501';
  end if;

  -- The caller must actually be able to see this post. RLS is bypassed under SECURITY DEFINER,
  -- so this is the real gate (a private post owned by someone else must not be mintable).
  if not public.can_view_post(p_post_id) then
    raise exception 'post not visible' using errcode = '42501';
  end if;

  select * into v_post from public.posts where id = p_post_id and deleted_at is null;
  if not found then
    raise exception 'no such post' using errcode = 'P0002';
  end if;

  -- Serialize per post: two concurrent first-saves must mint exactly one template.
  perform pg_advisory_xact_lock(hashtextextended(p_post_id::text, 0));

  -- Already minted (or a redo of a curated quest): nothing to do, hand back the existing id.
  -- Re-read under the lock so the loser of a race sees the winner's write.
  select template_id into v_template from public.posts where id = p_post_id;
  if v_template is not null then
    return v_template;
  end if;

  -- Title: the author's quest name, else the caption's first line, else a generic — the
  -- template's title is NOT NULL, so this chain must always resolve to something non-empty.
  v_title := coalesce(
    nullif(btrim(v_post.title), ''),
    nullif(left(btrim(v_post.caption), 60), ''),
    'untitled sidequest'
  );
  -- Slug is NOT NULL UNIQUE. kebab(title) + a post-id fragment is unique because a given post
  -- mints at most one template (guarded above), so the fragment never repeats.
  v_slug := left(regexp_replace(lower(v_title), '[^a-z0-9]+', '-', 'g'), 40)
            || '-' || substr(p_post_id::text, 1, 8);

  insert into public.quest_templates (slug, title, origin, created_by, geog)
  values (v_slug, v_title, 'user', v_uid, v_post.geog)
  returning id into v_template;

  -- Link the origin post and stamp it the 1st ever. coalesce guards the (rare) case where an
  -- ordinal was somehow already set; template_id + ordinal are written together so the posts
  -- CHECK (ordinal not null ⇒ template_id not null) holds.
  update public.posts
     set template_id = v_template,
         completion_ordinal = coalesce(completion_ordinal, 1)
   where id = p_post_id;

  return v_template;
end $$;

grant execute on function public.mint_template_from_post(uuid) to authenticated;
