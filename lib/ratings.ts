import { supabase } from './supabase';

/**
 * Casting a rating (T13's last open verb). Ratings are two buttons that critique the QUEST,
 * never the person — `awesome` / `could_be_cooler` (CLAUDE.md). The invariants are all enforced
 * in Postgres by the 005 policies, so the client only ever expresses intent:
 *   - you can't rate a post you can't see (`ratings_insert` → `can_view_post`),
 *   - you can't rate your own post (the screen also hides the control for the author),
 *   - you can't rate the same post twice (`ratings_one_per_rater` unique → this is an upsert).
 *
 * Reception XP is NOT awarded here. It's median-relative and finalised on a weekly schedule
 * (phase 2, CLAUDE.md → Gotchas), so casting a rating just writes the row; nothing touches the
 * ledger at rate time.
 */

export type RatingValue = 'awesome' | 'could_be_cooler';

/** Your current rating on this post, or null if you haven't weighed in. Drives the active button. */
export async function fetchMyRating(postId: string, raterId: string): Promise<RatingValue | null> {
  const { data, error } = await supabase
    .from('ratings')
    .select('value')
    .eq('post_id', postId)
    .eq('rater_id', raterId)
    .maybeSingle();
  if (error) throw error;
  return (data?.value as RatingValue | undefined) ?? null;
}

/**
 * Cast or change your rating. An upsert on the (post_id, rater_id) unique key, so tapping the
 * other button switches your vote rather than erroring on the duplicate — a rater may change
 * their mind (005 `ratings_update`).
 */
export async function castRating(postId: string, raterId: string, value: RatingValue): Promise<void> {
  const { error } = await supabase
    .from('ratings')
    .upsert({ post_id: postId, rater_id: raterId, value }, { onConflict: 'post_id,rater_id' });
  if (error) throw error;
}

/** Retract your rating entirely (tapping the button you already picked). 005 `ratings_delete`. */
export async function retractRating(postId: string, raterId: string): Promise<void> {
  const { error } = await supabase.from('ratings').delete().eq('post_id', postId).eq('rater_id', raterId);
  if (error) throw error;
}
