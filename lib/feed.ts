import { supabase } from './supabase';
import { aspectRatio, photoUri } from './photos';

/**
 * The feed data layer (T12). One query over `posts` — a post IS a completed quest
 * (CLAUDE.md), so the feed is not a join across a separate quest entity. RLS does the
 * privacy work: anon and authenticated both hit `posts_visible`, which already hides
 * private and soft-deleted rows, so the client never filters for safety — only for intent.
 *
 * The wire→view mapping is a pure function (`toFeedItem`) so it can be unit-tested without a
 * network or a running database — the one part of this file Jest can meaningfully cover
 * (RLS itself is pgTAP's job; a Node test with any key proves nothing about policies).
 */

/** A single primary photo, resolved to something the <Image> can render. */
export type FeedPhoto = {
  uri: string;
  /** width / height — reserves tile geometry so the masonry never reflows (DESIGN → Motion). */
  aspectRatio: number;
};

/** One tile in the masonry: photo → caption → `ORDINAL · NEIGHBOURHOOD` fact line. */
export type FeedItem = {
  id: string;
  caption: string | null;
  /** completion_ordinal — "you're the 4th ever". NULL for a template-less post. */
  ordinal: number | null;
  neighbourhood: string | null;
  handle: string | null;
  photo: FeedPhoto | null;
};

/** Shape returned by the PostgREST nested select below. to-one → object, to-many → array. */
type FeedRow = {
  id: string;
  caption: string | null;
  completion_ordinal: number | null;
  created_at: string;
  /** the post's own captured neighbourhood — the fallback before a template is minted (019). */
  neighbourhood: string | null;
  author: { handle: string | null } | null;
  template: { neighbourhood: string | null } | null;
  photos: { storage_path: string; idx: number; width: number | null; height: number | null }[];
};

// The columns the feed needs, and only those. Embeds resolve through the FKs PostgREST
// already knows about (posts.user_id → users, posts.template_id → quest_templates,
// post_photos.post_id → posts).
const FEED_SELECT =
  'id,caption,completion_ordinal,created_at,neighbourhood,' +
  'author:users(handle),' +
  'template:quest_templates(neighbourhood),' +
  'photos:post_photos(storage_path,idx,width,height)';

/** Pure wire→view mapping. Picks the primary photo (lowest idx) and resolves its URL. */
export function toFeedItem(row: FeedRow): FeedItem {
  const primary = [...row.photos].sort((a, b) => a.idx - b.idx)[0];
  return {
    id: row.id,
    caption: row.caption,
    ordinal: row.completion_ordinal,
    // Template name is canonical; fall back to the post's own for a not-yet-minted post (019).
    neighbourhood: row.template?.neighbourhood ?? row.neighbourhood ?? null,
    handle: row.author?.handle ?? null,
    photo: primary
      ? { uri: photoUri(primary.storage_path), aspectRatio: aspectRatio(primary.width, primary.height) }
      : null,
  };
}

/**
 * Fetch the newest public posts for the front door. `deleted_at is null` is stated for
 * intent and to hit the partial `posts_feed` index; RLS enforces it regardless. Newest
 * first — the "what's new" tab. Other tabs (popular / rarest / nearby) are separate queries,
 * not wired yet (rarest is still "confirm before building" in DESIGN.md → Open).
 */
export async function fetchFeed({ limit = 40 }: { limit?: number } = {}): Promise<FeedItem[]> {
  const { data, error } = await supabase
    .from('posts')
    .select(FEED_SELECT)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data as unknown as FeedRow[]).map(toFeedItem);
}

/**
 * The "nearby" feed — the same masonry, ordered by distance from the viewer instead of by time.
 * The `feed_nearby` RPC (022) does the KNN sort in Postgres and returns `setof posts`, so we
 * embed author/template/photos on the result exactly as the time feed does; the RPC's order is
 * preserved. RLS runs inside the (invoker) function, so private posts stay hidden here too.
 */
export async function fetchNearby(
  coords: { lon: number; lat: number },
  { limit = 40 }: { limit?: number } = {},
): Promise<FeedItem[]> {
  const { data, error } = await supabase
    .rpc('feed_nearby', { p_lon: coords.lon, p_lat: coords.lat, p_limit: limit })
    .select(FEED_SELECT);

  if (error) throw error;
  return (data as unknown as FeedRow[]).map(toFeedItem);
}

/**
 * One user's completed quests, newest first — the same posts query, filtered to an author.
 * RLS does exactly the right thing without a special case: on your own profile you see your
 * public *and* private posts (the `posts_visible` policy lets you see your own), on someone
 * else's you see only their public ones. So there's no separate "is this me?" branch — the
 * policy is the branch.
 */
export async function fetchUserPosts(
  userId: string,
  { limit = 40 }: { limit?: number } = {},
): Promise<FeedItem[]> {
  const { data, error } = await supabase
    .from('posts')
    .select(FEED_SELECT)
    .eq('user_id', userId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data as unknown as FeedRow[]).map(toFeedItem);
}

/** A saved-collection row: the post columns above plus which template it belongs to and its title. */
type SavedRow = FeedRow & { template_id: string; template: { title: string | null; neighbourhood: string | null } | null };

const SAVED_SELECT =
  'id,caption,completion_ordinal,created_at,neighbourhood,template_id,' +
  'author:users(handle),' +
  'template:quest_templates(title,neighbourhood),' +
  'photos:post_photos(storage_path,idx,width,height)';

/**
 * Pure wire→view mapping for a saved tile. Unlike a feed tile, a saved quest is shown by its
 * QUEST NAME (the template title), not one person's caption, and it carries NO rarity ordinal:
 * a saved log is a list of quests-to-do, so a column of red "1ST"s would both read flat and
 * dilute the rarity mark (DESIGN: red is the one fact, not decoration). The tile therefore
 * renders as title + neighbourhood only — QuestTile draws no red when `ordinal` is null.
 */
export function toSavedItem(row: SavedRow): FeedItem {
  const primary = [...row.photos].sort((a, b) => a.idx - b.idx)[0];
  return {
    id: row.id,
    caption: row.template?.title ?? row.caption ?? null,
    ordinal: null,
    neighbourhood: row.template?.neighbourhood ?? row.neighbourhood ?? null,
    handle: null,
    photo: primary
      ? { uri: photoUri(primary.storage_path), aspectRatio: aspectRatio(primary.width, primary.height) }
      : null,
  };
}

/**
 * Your saved quest log — the quests you saved to do, newest save first. A save targets a
 * TEMPLATE, not a post (005), and detail is keyed by a post, so each saved template is shown by
 * its canonical **origin post** (the 1st-ever, `completion_ordinal = 1` — the instance whose
 * title/photo defined the quest); tapping opens that quest. `saves_own_read` RLS scopes this to
 * you, and `posts_visible` still hides anything you shouldn't see.
 *
 * Two round trips on purpose: the saved template ids (in save order) first, then their posts,
 * so the collection keeps *save* order rather than post recency. The lowest-ordinal visible post
 * per template wins (the origin), and templates whose origin isn't visible drop out quietly.
 */
export async function fetchSavedQuests(
  userId: string,
  { limit = 40 }: { limit?: number } = {},
): Promise<FeedItem[]> {
  const { data: saveRows, error: saveErr } = await supabase
    .from('saves')
    .select('template_id')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (saveErr) throw saveErr;

  const templateIds = (saveRows as { template_id: string }[] | null)?.map((r) => r.template_id) ?? [];
  if (templateIds.length === 0) return [];

  const { data, error } = await supabase
    .from('posts')
    .select(SAVED_SELECT)
    .in('template_id', templateIds)
    .is('deleted_at', null)
    .order('completion_ordinal', { ascending: true, nullsFirst: false });
  if (error) throw error;

  // Lowest ordinal per template = the origin post. Then re-order to match the save order.
  const originByTemplate = new Map<string, SavedRow>();
  for (const row of data as unknown as SavedRow[]) {
    if (!originByTemplate.has(row.template_id)) originByTemplate.set(row.template_id, row);
  }
  return templateIds
    .map((id) => originByTemplate.get(id))
    .filter((row): row is SavedRow => row != null)
    .map(toSavedItem);
}
