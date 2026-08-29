-- 017_create_post_axes.sql — carry the author's classification through create_post.
--
-- 016 added posts.effort/nerve/cost_pence; create_post must accept and store them so a
-- first-of-its-kind post's axes survive until the mint (018) copies them onto the template.
-- p_effort/p_nerve/p_cost_pence are appended (not inserted) after 014's p_title so every
-- existing positional caller stays valid — the same additive-tail discipline as 012 and 014.
-- The 016 CHECK constraints are the backstop; the client sends a 1..3 tier or NULL.

drop function public.create_post(
  uuid, text[], uuid, text, public.post_visibility, double precision, double precision, text,
  integer[], integer[], text
);

create function public.create_post(
  p_post_id       uuid,
  p_photo_paths   text[],
  p_template_id   uuid                    default null,
  p_caption       text                    default null,
  p_visibility    public.post_visibility  default 'public',
  p_lon           double precision        default null,
  p_lat           double precision        default null,
  p_city          text                    default 'London',
  p_photo_widths  integer[]               default null,
  p_photo_heights integer[]               default null,
  p_title         text                    default null,
  p_effort        smallint                default null,
  p_nerve         smallint                default null,
  p_cost_pence    integer                 default null
) returns jsonb
  language plpgsql security definer set search_path = ''
as $$
declare
  v_uid          uuid := auth.uid();
  v_post         public.posts;
  v_ordinal      integer;
  v_geog         extensions.geography;
  v_awarded      integer;
  v_total        integer;
  v_level_before integer;
  v_level_after  integer;
  v_post_xp constant integer := 50;   -- flat post award; photo bonus is folded in (D3/D4)
begin
  if v_uid is null then
    raise exception 'must be signed in to post' using errcode = '42501';
  end if;

  if p_photo_paths is null or array_length(p_photo_paths, 1) is null then
    raise exception 'a post requires at least one photo' using errcode = '23514';
  end if;

  -- Idempotent retry: same p_post_id → the post already exists → return state, award nothing.
  select * into v_post from public.posts where id = p_post_id;
  if found then
    if v_post.user_id <> v_uid then
      raise exception 'post id belongs to another user' using errcode = '42501';
    end if;
    v_total := (select coalesce(sum(delta), 0)::int
                  from public.xp_ledger where user_id = v_uid);
    return jsonb_build_object(
      'post', to_jsonb(v_post),
      'xp_total', v_total,
      'level', public.level_for_xp(v_total),
      'leveled_up', false
    );
  end if;

  if p_lon is not null and p_lat is not null then
    v_geog := extensions.st_setsrid(extensions.st_makepoint(p_lon, p_lat), 4326)::extensions.geography;
  end if;

  if p_template_id is not null then
    perform pg_advisory_xact_lock(hashtextextended(p_template_id::text, 0));
    v_ordinal := (select count(*) from public.posts where template_id = p_template_id) + 1;
  end if;

  insert into public.posts
    (id, user_id, template_id, title, caption, visibility, completion_ordinal, geog, city,
     effort, nerve, cost_pence)
  values
    (p_post_id, v_uid, p_template_id, p_title, p_caption, p_visibility, v_ordinal, v_geog, p_city,
     p_effort, p_nerve, p_cost_pence)
  returning * into v_post;

  insert into public.post_photos (post_id, storage_path, idx, width, height)
  select p_post_id, path, ord - 1, w, h
  from unnest(
         p_photo_paths,
         coalesce(p_photo_widths, '{}'::integer[]),
         coalesce(p_photo_heights, '{}'::integer[])
       ) with ordinality as t(path, w, h, ord);

  if p_template_id is not null then
    insert into public.xp_ledger (user_id, kind, template_id, delta)
    values (v_uid, 'post', p_template_id, v_post_xp)
    on conflict do nothing
    returning delta into v_awarded;
  else
    insert into public.xp_ledger (user_id, kind, source_id, delta)
    values (v_uid, 'post', p_post_id, v_post_xp)
    on conflict do nothing
    returning delta into v_awarded;
  end if;
  v_awarded := coalesce(v_awarded, 0);

  v_total        := (select coalesce(sum(delta), 0)::int
                       from public.xp_ledger where user_id = v_uid);
  v_level_before := public.level_for_xp(v_total - v_awarded);
  v_level_after  := public.level_for_xp(v_total);

  return jsonb_build_object(
    'post', to_jsonb(v_post),
    'xp_total', v_total,
    'level', v_level_after,
    'leveled_up', v_level_after > v_level_before
  );
end $$;

grant execute on function public.create_post(
  uuid, text[], uuid, text, public.post_visibility, double precision, double precision, text,
  integer[], integer[], text, smallint, smallint, integer
) to authenticated;
