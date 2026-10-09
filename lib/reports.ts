import { supabase } from './supabase';

/**
 * Reporting a post (W3 / App Store Guideline 1.2 — the user-facing flag mechanism). The DB (024)
 * enforces every rule via RLS: report as yourself, only a post you can see, never your own, once
 * per post. The client only expresses intent; acting on a report is out-of-band moderation over
 * the service role, never a client capability.
 */

export type ReportReason = 'spam' | 'nudity' | 'violence' | 'hate' | 'other';

/** The reasons, in display order, with the label shown in the sheet (DESIGN voice: lowercase). */
export const REPORT_REASONS: { value: ReportReason; label: string }[] = [
  { value: 'spam', label: 'spam or a scam' },
  { value: 'nudity', label: 'nudity or sexual content' },
  { value: 'violence', label: 'violence or danger' },
  { value: 'hate', label: 'hate or harassment' },
  { value: 'other', label: 'something else' },
];

/**
 * File a report against a post. A note is optional; an empty/whitespace note is dropped to null
 * so it never trips the DB's 1..500 length check. A duplicate (you already reported this post)
 * surfaces as the unique-violation code so the UI can say "already reported" rather than a raw error.
 */
export async function reportPost(
  postId: string,
  reporterId: string,
  reason: ReportReason,
  note?: string,
): Promise<void> {
  const trimmed = note?.trim();
  const { error } = await supabase.from('reports').insert({
    post_id: postId,
    reporter_id: reporterId,
    reason,
    note: trimmed ? trimmed : null,
  });
  if (error) throw error;
}
