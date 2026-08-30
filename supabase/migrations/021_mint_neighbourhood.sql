-- 021_mint_neighbourhood.sql — the minted template inherits the origin post's neighbourhood.
--
-- The last mile of the location flow, mirroring 018 (which did the same for the axes). The mint
-- already copies the post's geog onto the template; now it also copies the neighbourhood *name*,
-- so the fact line reads "SHOREDITCH" for everyone who later saves or redoes the quest instead
-- of "—". Pure column-copy addition; idempotency, the advisory lock, the visibility guard and
-- the ordinal backfill are all unchanged.

create or replace function public.mint_template_from_post(p_post_id uuid) returns uuid
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
  select template_id into v_template from public.posts where id = p_post_id;
  if v_template is not null then
    return v_template;
  end if;

  v_title := coalesce(
    nullif(btrim(v_post.title), ''),
    nullif(left(btrim(v_post.caption), 60), ''),
    'untitled sidequest'
  );
  v_slug := left(regexp_replace(lower(v_title), '[^a-z0-9]+', '-', 'g'), 40)
            || '-' || substr(p_post_id::text, 1, 8);

  -- Copy the author's classification AND location name onto the template alongside title/geog,
  -- so both the stamp block and the fact line show real values instead of "—". A post with
  -- nothing captured inherits NULLs — an honest em-dash, not a guess.
  insert into public.quest_templates
    (slug, title, origin, created_by, geog, neighbourhood, effort, nerve, cost_pence)
  values
    (v_slug, v_title, 'user', v_uid, v_post.geog, v_post.neighbourhood,
     v_post.effort, v_post.nerve, v_post.cost_pence)
  returning id into v_template;

  update public.posts
     set template_id = v_template,
         completion_ordinal = coalesce(completion_ordinal, 1)
   where id = p_post_id;

  return v_template;
end $$;

grant execute on function public.mint_template_from_post(uuid) to authenticated;
