-- 022_feed_nearby.sql — the "nearby" feed tab (DESIGN.md → Layout lists it; only "what's new"
-- was wired). Now that posts capture geog at compose time (020), nearest-first is possible.
--
-- Why an RPC and not a PostgREST order: PostgREST can't express `order by geog <-> point`
-- (the KNN distance operator), and doing the sort client-side would mean shipping every post
-- to rank a handful. This function does the ordering in Postgres, where the gist index on
-- posts.geog (003) makes it cheap as the catalog grows.
--
-- SECURITY INVOKER (the default — deliberately NOT definer): the body's select on posts runs
-- as the *caller*, so the `posts_visible` RLS policy (003) applies exactly as it does on the
-- normal feed — a private post stays hidden from anon and from other users, no extra guard
-- needed. A definer here would bypass RLS and leak private posts by distance, so this must
-- stay invoker. Returns `setof posts` so the client can embed author/template/photos on the
-- result the same way the feed query does; the function's order is preserved.

create function public.feed_nearby(
  p_lon   double precision,
  p_lat   double precision,
  p_limit integer default 40
) returns setof public.posts
  language sql
  stable
  security invoker
  set search_path = ''
as $$
  select p.*
  from public.posts p
  where p.deleted_at is null
    and p.geog is not null
  order by p.geog operator(extensions.<->)
           extensions.st_setsrid(extensions.st_makepoint(p_lon, p_lat), 4326)::extensions.geography
  limit greatest(coalesce(p_limit, 40), 0);
$$;

-- Anon can browse nearby too (the cold web funnel); RLS still hides private posts from them.
grant execute on function public.feed_nearby(double precision, double precision, integer) to anon, authenticated;
