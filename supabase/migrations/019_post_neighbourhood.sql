-- 019_post_neighbourhood.sql — a post remembers where it happened, by name.
--
-- posts already carry geog+city (003, C4) for phase-2 nearby/leaderboards, but the feed tile
-- and quest detail show a *neighbourhood name* ("SHOREDITCH") on the ORDINAL · NEIGHBOURHOOD
-- fact line — and that name only ever lived on quest_templates. So a first-of-its-kind post
-- had no name to show (the fact line read "—"), and a minted template inherited nothing. This
-- column is that name's home on the post, captured at compose time (device location → reverse
-- geocode) exactly as the axes are (016). The mint (021) copies it onto the template, and the
-- feed/detail mappers fall back to it for a not-yet-minted post — the same pattern as title.
--
-- Nullable: capturing location is optional (permission may be denied, or the author skips), and
-- an absent neighbourhood renders "—" rather than a guess. Bounded to a short label, like a
-- neighbourhood name, not prose — the fact line is mono and must stay a fact. Rides the existing
-- posts RLS (003); no policy change.

alter table public.posts
  add column neighbourhood text,
  add constraint posts_neighbourhood_len
    check (neighbourhood is null or char_length(neighbourhood) between 1 and 60);
