import { supabase } from './supabase';

/**
 * Handle claim — the one bit of onboarding. `users.handle` is NULL until claimed (001, C6),
 * so a brand-new user has no byline until they pick one; the AuthSheet folds this in right
 * after a first sign-in.
 *
 * The format rule mirrors the `users_handle_format` CHECK in 010 exactly (3–20 of [a-z0-9_]).
 * The client validates so the user gets an instant inline message instead of a round-trip, but
 * the DB is the real gate — RLS lets a user write their own row, so a hand-rolled call can't be
 * trusted. `normalizeHandle`/`validateHandle` are pure so Jest can prove them.
 */

const HANDLE_RE = /^[a-z0-9_]{3,20}$/;

/** Lowercase, trim, drop a leading `@`. What the user typed → what we store. */
export function normalizeHandle(raw: string): string {
  return raw.trim().replace(/^@+/, '').toLowerCase();
}

/** null when the normalised handle is claimable; otherwise a blunt-but-kind reason (DESIGN voice). */
export function validateHandle(raw: string): string | null {
  const h = normalizeHandle(raw);
  if (h.length < 3) return 'a bit short — 3 characters or more.';
  if (h.length > 20) return 'a bit long — 20 characters max.';
  if (!HANDLE_RE.test(h)) return 'letters, numbers and underscores only.';
  return null;
}

/** Thrown by claimHandle when the handle is already someone else's (unique violation). */
export class HandleTakenError extends Error {
  constructor() {
    super('handle taken');
    this.name = 'HandleTakenError';
  }
}

/** The signed-in user's current handle (NULL before a claim). */
export async function fetchMyHandle(): Promise<string | null> {
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) return null;
  const { data, error } = await supabase.from('users').select('handle').eq('id', uid).maybeSingle();
  if (error) throw error;
  return data?.handle ?? null;
}

/**
 * Claim `handle` for the signed-in user. Normalises first, then writes; a unique violation
 * (someone got there first) surfaces as HandleTakenError so the UI can say "taken" specifically.
 * The write is gated to the caller's own row by users_self_write.
 */
export async function claimHandle(raw: string): Promise<string> {
  const handle = normalizeHandle(raw);
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) throw new Error('not signed in');

  const { error } = await supabase.from('users').update({ handle }).eq('id', uid);
  if (error) {
    if (error.code === '23505') throw new HandleTakenError();
    throw error;
  }
  return handle;
}
