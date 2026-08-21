import { supabase } from './supabase';

/** Bucket real post photos live in. Seed rows store full URLs instead (see below). */
export const PHOTOS_BUCKET = 'photos';

/**
 * Resolve a `post_photos.storage_path` to a displayable URL.
 *
 * Two shapes are supported on purpose:
 *   - a full `http(s)` URL → returned as-is. Seed fixtures store these (picsum), and a
 *     future CDN-hosted photo would too. No round-trip, no bucket assumption.
 *   - anything else → treated as an object key in the `photos` storage bucket and resolved
 *     with `getPublicUrl`. This is the path real uploads take.
 *
 * Keeping both here means the feed never has to know which kind it's holding.
 */
export function photoUri(storagePath: string): string {
  if (/^https?:\/\//i.test(storagePath)) return storagePath;
  return supabase.storage.from(PHOTOS_BUCKET).getPublicUrl(storagePath).data.publicUrl;
}

/**
 * Aspect ratio (width / height) for reserving a tile's geometry before the image loads —
 * the masonry must never reflow after paint (DESIGN.md → Motion). Falls back to the portrait
 * default when a photo's dimensions are unknown (NULL until create_post threads them through).
 */
export const DEFAULT_TILE_ASPECT = 0.8;

export function aspectRatio(width: number | null, height: number | null): number {
  if (width && height && width > 0 && height > 0) return width / height;
  return DEFAULT_TILE_ASPECT;
}
