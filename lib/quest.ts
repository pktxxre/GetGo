import { supabase } from './supabase';
import { aspectRatio, photoUri } from './photos';
import type { FeedPhoto } from './feed';

/**
 * Quest-detail data layer (T13). One row from `posts` with its template, author, photos and
 * ratings embedded — RLS decides visibility exactly as it does on the feed, so a private or
 * soft-deleted post resolves to `null` and the screen shows `notFound`. The wire→view map is
 * pure (`toQuestDetail`) for the same reason as the feed: it's the part Jest can prove.
 *
 * Reception counts are folded from the embedded ratings here. That's fine at seed scale; a
 * post with thousands of ratings will want a server-side aggregate (phase 2), noted so the
 * embed isn't mistaken for the final shape.
 */

export type QuestDetail = {
  id: string;
  /** the quest this post completed; the save target. NULL for a first-of-its-kind post. */
  templateId: string | null;
  title: string | null;
  caption: string | null;
  /** completion_ordinal — the stamped "you're the Nth ever". */
  ordinal: number | null;
  handle: string | null;
  /** the author's user id — links the byline to their quests. */
  authorId: string | null;
  neighbourhood: string | null;
  /** 1..3 tiers; null when the template is redo-minted and has no axes yet. */
  effort: number | null;
  nerve: number | null;
  costPence: number | null;
  photos: FeedPhoto[];
  awesome: number;
  couldBeCooler: number;
};

type QuestRow = {
  id: string;
  template_id: string | null;
  user_id: string;
  title: string | null;
  caption: string | null;
  completion_ordinal: number | null;
  /** the post's own captured neighbourhood — the fallback before a template is minted (019). */
  neighbourhood: string | null;
  author: { handle: string | null } | null;
  template:
    | { title: string | null; neighbourhood: string | null; effort: number | null; nerve: number | null; cost_pence: number | null }
    | null;
  photos: { storage_path: string; idx: number; width: number | null; height: number | null }[];
  ratings: { value: 'awesome' | 'could_be_cooler' }[];
};

const QUEST_SELECT =
  'id,template_id,user_id,title,caption,completion_ordinal,neighbourhood,' +
  'author:users(handle),' +
  'template:quest_templates(title,neighbourhood,effort,nerve,cost_pence),' +
  'photos:post_photos(storage_path,idx,width,height),' +
  'ratings:ratings(value)';

export function toQuestDetail(row: QuestRow): QuestDetail {
  const photos = [...row.photos]
    .sort((a, b) => a.idx - b.idx)
    .map((p) => ({ uri: photoUri(p.storage_path), aspectRatio: aspectRatio(p.width, p.height) }));

  let awesome = 0;
  let couldBeCooler = 0;
  for (const r of row.ratings) {
    if (r.value === 'awesome') awesome++;
    else couldBeCooler++;
  }

  return {
    id: row.id,
    templateId: row.template_id,
    // Prefer the template's canonical name; fall back to the post's own name for a
    // first-of-its-kind post that hasn't been minted into a template yet (015).
    title: row.template?.title ?? row.title ?? null,
    caption: row.caption,
    ordinal: row.completion_ordinal,
    handle: row.author?.handle ?? null,
    authorId: row.user_id ?? null,
    // Template name is canonical; fall back to the post's own for a not-yet-minted post (019).
    neighbourhood: row.template?.neighbourhood ?? row.neighbourhood ?? null,
    effort: row.template?.effort ?? null,
    nerve: row.template?.nerve ?? null,
    costPence: row.template?.cost_pence ?? null,
    photos,
    awesome,
    couldBeCooler,
  };
}

/** Fetch one quest by post id. Resolves to `null` when the post isn't visible (→ 404). */
export async function fetchQuest(id: string): Promise<QuestDetail | null> {
  const { data, error } = await supabase
    .from('posts')
    .select(QUEST_SELECT)
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;
  return toQuestDetail(data as unknown as QuestRow);
}
