import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';

/**
 * Auth via email OTP (a 6-digit code), chosen for the cold web funnel: a stranger who arrives
 * from a TikTok link and taps `save it` gets asked for an email and a code — no password, no
 * social-SDK setup, no deep-link redirect dance, identical on web and native. Social + Sign
 * in with Apple is the App Store gate and lands with the native build, not the funnel.
 *
 * The supabase client keeps the session and injects the bearer token, so authenticated
 * PostgREST calls Just Work. The client now persists that session across restarts via an
 * AsyncStorage adapter (see lib/supabase.ts), so `getSession()` below rehydrates a prior
 * sign-in on cold start — no re-auth on every reload. `onAuthStateChange` keeps this provider
 * in sync with sign-in, token refresh and sign-out.
 */

type AuthContextValue = {
  session: Session | null;
  /** true until the initial getSession() resolves — avoids a signed-out flash. */
  initializing: boolean;
  /** send a login code to this email (creates the user if new). */
  sendCode: (email: string) => Promise<void>;
  /** verify the 6-digit code; on success the session lands via onAuthStateChange. */
  verifyCode: (email: string, token: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setInitializing(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => sub.subscription.unsubscribe();
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      initializing,
      sendCode: async (email) => {
        const { error } = await supabase.auth.signInWithOtp({
          email: email.trim(),
          options: { shouldCreateUser: true },
        });
        if (error) throw error;
      },
      verifyCode: async (email, token) => {
        const { error } = await supabase.auth.verifyOtp({ email: email.trim(), token: token.trim(), type: 'email' });
        if (error) throw error;
      },
      signOut: async () => {
        await supabase.auth.signOut();
      },
    }),
    [session, initializing],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useSession(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useSession must be used within <SessionProvider>');
  return ctx;
}
