import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState, Platform } from 'react-native';

/**
 * Supabase client. Env vars must carry the EXPO_PUBLIC_ prefix or Expo won't expose
 * them to the client bundle (see CLAUDE.md). Put them in `.env` — never commit it.
 *
 * Session persistence: the OTP auth decision is settled (lib/auth.tsx), so the session now
 * persists across restarts via AsyncStorage — sign in once and stay signed in, instead of
 * being logged out on every reload. AsyncStorage is backed by localStorage on web and native
 * storage on device, so one adapter covers both. `detectSessionInUrl` stays false: we verify
 * a typed 6-digit code, never a magic-link redirect, so there's no URL fragment to read.
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

// Expo's web build statically prerenders routes in Node, where there's no `window` — and
// AsyncStorage's web build reaches for localStorage, which throws there. So we persist on
// device and in the browser (AsyncStorage → native store / localStorage) but no-op during
// that server prerender. Native has no `window` either, hence the Platform.OS guard: it
// isolates *web* SSR specifically, so a real device still gets a persisted session.
const isWebSSR = Platform.OS === 'web' && typeof window === 'undefined';
const noopStorage = {
  getItem: async () => null,
  setItem: async () => {},
  removeItem: async () => {},
};

// A placeholder URL keeps createClient from throwing before .env exists; any real call
// still fails loudly, which is what we want during scaffold.
export const supabase: SupabaseClient = createClient(
  url ?? 'http://localhost:54321',
  anonKey ?? 'public-anon-key-not-set',
  {
    auth: {
      storage: isWebSSR ? noopStorage : AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  },
);

// Refresh the access token only while the app is foregrounded (Supabase RN guidance): a
// backgrounded app has no reason to keep spending refreshes, and it resumes promptly on
// return. On web, AppState 'change' rides the tab's visibility. Skipped under web SSR — no
// AppState/window to attach to during prerender.
if (!isWebSSR) {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}
