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
  author: { handle: string | null } | null;
  template: { neighbourhood: string | null } | null;
  photos: { storage_path: string; idx: number; width: number | null; height: number | null }[];
};

// The columns the feed needs, and only those. Embeds resolve through the FKs PostgREST
// already knows about (posts.user_id → users, posts.template_id → quest_templates,
// post_photos.post_id → posts).
const FEED_SELECT =
  'id,caption,completion_ordinal,created_at,' +
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
    neighbourhood: row.template?.neighbourhood ?? null,
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
