import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Supabase client. Env vars must carry the EXPO_PUBLIC_ prefix or Expo won't expose
 * them to the client bundle (see CLAUDE.md). Put them in `.env` — never commit it.
 *
 * Auth persistence/session storage is deliberately not wired yet: the auth mechanism
 * (magic link / OTP vs. social + Sign in with Apple) is an open week-one decision in
 * HANDOFF.md, and that choice determines the storage + deep-link setup. This client is
 * enough to talk to Postgres/storage in the meantime.
 */

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(url && anonKey);

if (!isSupabaseConfigured && __DEV__) {
  console.warn(
    '[supabase] EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY are not set. ' +
      'Copy .env.example to .env and fill them in. Backend calls will fail until then.',
  );
}

// A placeholder URL keeps createClient from throwing before .env exists; any real call
// still fails loudly, which is what we want during scaffold.
export const supabase: SupabaseClient = createClient(
  url ?? 'http://localhost:54321',
  anonKey ?? 'public-anon-key-not-set',
  {
    auth: {
      autoRefreshToken: true,
      persistSession: false,
      detectSessionInUrl: false,
    },
  },
);
