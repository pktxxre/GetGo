-- 004_visibility.sql — the child-table visibility helper (C1).
--
-- The posts feed inlines its predicate (003) because a SECURITY DEFINER function is never
-- inlined by the planner and would cost a per-row call on the hot path. The child tables
-- (post_photos here; ratings and saves in 005; storage later) are different: the row count
-- is already bounded by the parent post the client fetched, so DRY wins and they go through
-- one helper. Change the visibility rule in exactly one place for the children.

-- SECURITY DEFINER so it can see posts regardless of the caller's own row visibility;
-- `set search_path = ''` is mandatory (privilege-escalation vector otherwise), which is why
-- every name below is schema-qualified, auth.uid() included. STABLE: same answer within a
-- statement, so the planner can cache it per post id.
create function public.can_view_post(p_post_id uuid) returns boolean
  language sql stable security definer set search_path = '' as $$
    select exists (
      select 1
      from public.posts p
      where p.id = p_post_id
        and p.deleted_at is null
        and (p.visibility = 'public' or p.user_id = auth.uid())
    )
  $$;

-- A photo is visible exactly when its post is. Same rule as the feed, one function call,
-- bounded rows.
create policy post_photos_visible on public.post_photos
  for select using (public.can_view_post(post_id));

grant select on public.post_photos to anon, authenticated;
grant execute on function public.can_view_post(uuid) to anon, authenticated;
