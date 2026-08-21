-- 008_photo_dimensions.sql — intrinsic photo dimensions on post_photos.
--
-- The feed is a 2-column masonry at native aspect ratio, and DESIGN.md → Motion is explicit
-- that "the masonry must never move after paint". The client can only reserve a tile's
-- geometry before the image bytes arrive if it knows the photo's aspect ratio up front — so
-- width/height belong in the row, not discovered client-side (that discovery IS the reflow
-- the design bans).
--
-- Both are nullable: dimensions are metadata every real capture has, but they are not yet
-- threaded through create_post (that RPC's signature is the locked D14 contract, changed
-- deliberately not incidentally). Photos inserted by the seed carry dimensions; photos made
-- through create_post carry NULL for now and the client falls back to a default aspect. This
-- is an additive column change: no RLS rule and no XP path moves, so post_photos keeps its
-- existing can_view_post() read policy unchanged.

alter table public.post_photos
  add column width  integer,
  add column height integer,
  -- Dimensions, when present, are positive. NULL stays legal (unknown / pre-RPC-threading).
  add constraint post_photos_dims_positive
    check ((width is null or width > 0) and (height is null or height > 0));
