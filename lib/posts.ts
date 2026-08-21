import { supabase } from './supabase';
import { PHOTOS_BUCKET } from './photos';

/**
 * Post creation (T13-post) — the create side of the loop. A signed-in user photographs a
 * sidequest they went on and posts it; a post IS a completed quest (CLAUDE.md). This first
 * version mints a *first-of-its-kind* post (no template) — `create_post` stamps a NULL ordinal
 * and a source-keyed XP row for it (007/C5). Redoing an existing quest against its template,
 * and the mint-template RPC that lets others redo *this* one, are the follow-ups.
 *
 * The DB owns the transaction and all XP math (create_post, D14); the client's only jobs are
 * to put the photo bytes in storage under the user's own prefix (011 RLS) and hand the object
 * keys to the RPC. The idempotency contract is client-driven: we generate the post id up front
 * and reuse it on a retry, so a failed-then-retried post never double-awards.
 *
 * `photoObjectKey`, `extFromUri` and `uuidv4` are pure so Jest can prove the parts that matter;
 * the upload + RPC round-trip is thin glue proven live against the stack.
 */

export type NewPostVisibility = 'public' | 'private';

export type PhotoInput = {
  /** local file uri from the image picker/camera. */
  uri: string;
  /** mime type when the picker reports one; used for the storage contentType. */
  mimeType?: string | null;
  /** pixel dimensions from the picker — threaded to create_post so the masonry never reflows. */
  width?: number | null;
  height?: number | null;
};

export type CreatePostInput = {
  photos: PhotoInput[];
  /** the quest's name — becomes the minted template's title on first save (015). Optional. */
  title?: string | null;
  caption?: string | null;
  visibility?: NewPostVisibility;
  /**
   * The template this post completes, when redoing an existing quest ("I did this too"). Set →
   * create_post stamps the next completion_ordinal and rarity climbs; null → a first-of-its-kind
   * post (no template until someone saves it, 015).
   */
  templateId?: string | null;
};

/** create_post's jsonb result — the XP state the client animates from (D14). */
export type CreatePostResult = {
  post: { id: string };
  xp_total: number;
  level: number;
  leveled_up: boolean;
};

const MIME_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
  'image/heif': 'heif',
};

/** Lowercased extension (no dot). jpg unless the uri clearly says otherwise. */
export function extFromUri(uri: string): string {
  const match = /\.([a-zA-Z0-9]{1,5})(?:\?|#|$)/.exec(uri);
  const ext = match?.[1]?.toLowerCase();
  return ext && ext.length <= 5 ? ext : 'jpg';
}

/** Object key for a post photo: `{userId}/{postId}/{idx}.{ext}` — the first segment is the
 *  owner prefix the storage insert policy checks (011). */
export function photoObjectKey(userId: string, postId: string, idx: number, ext: string): string {
  return `${userId}/${postId}/${idx}.${ext}`;
}

/** RFC-4122 v4 uuid. Uses the platform crypto when present (Expo runtime, web, node ≥19). */
export function uuidv4(): string {
  const c = (globalThis as { crypto?: Crypto }).crypto;
  if (c?.randomUUID) return c.randomUUID();
  // Fallback: still v4-shaped; only reached where no platform crypto exists.
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (ch) => {
    const r = (Math.random() * 16) | 0;
    return (ch === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

async function uploadPhoto(userId: string, postId: string, idx: number, photo: PhotoInput): Promise<string> {
  const ext = photo.mimeType && MIME_EXT[photo.mimeType] ? MIME_EXT[photo.mimeType] : extFromUri(photo.uri);
  const key = photoObjectKey(userId, postId, idx, ext);
  // fetch(file://…).blob() is the cross-platform way to get the bytes (native + web).
  const res = await fetch(photo.uri);
  const blob = await res.blob();
  const { error } = await supabase.storage
    .from(PHOTOS_BUCKET)
    .upload(key, blob, { contentType: photo.mimeType ?? blob.type ?? undefined, upsert: true });
  if (error) throw error;
  return key;
}

/**
 * Upload the photos, then create the post in one RPC. Photos are required (create_post rejects
 * an empty set); the caller guarantees at least one. Returns the XP state to animate from.
 */
export async function createPost(input: CreatePostInput): Promise<CreatePostResult> {
  if (input.photos.length === 0) throw new Error('a post needs at least one photo');

  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) throw new Error('must be signed in to post');

  const postId = uuidv4();
  const paths: string[] = [];
  for (let i = 0; i < input.photos.length; i++) {
    paths.push(await uploadPhoto(uid, postId, i, input.photos[i]));
  }

  const { data, error } = await supabase.rpc('create_post', {
    p_post_id: postId,
    p_photo_paths: paths,
    p_template_id: input.templateId ?? null,
    p_caption: input.caption?.trim() ? input.caption.trim() : null,
    p_visibility: input.visibility ?? 'public',
    // Dims zip to paths by position; the RPC pads with NULL when a photo has none.
    p_photo_widths: input.photos.map((p) => p.width ?? null),
    p_photo_heights: input.photos.map((p) => p.height ?? null),
    p_title: input.title?.trim() ? input.title.trim() : null,
  });
  if (error) throw error;
  return data as CreatePostResult;
}
