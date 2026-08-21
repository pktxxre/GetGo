import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { color } from '../theme/tokens';
import { ErrorBoundary } from '../components/shell/ErrorBoundary';
import { SessionProvider } from '../lib/auth';

export default function RootLayout() {
  return (
    <>
      <StatusBar style="dark" />
      {/* One boundary over the whole nav tree: a render error anywhere shows `crashed`
          instead of a white screen, and resets on route change (S5). */}
      <ErrorBoundary>
        {/* Auth session is app-wide: the feed reads as anon, a save prompts for identity. */}
        <SessionProvider>
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: color.ground },
              // No dark mode at launch — one ground, done properly (DESIGN.md).
              animation: 'fade',
            }}
          />
        </SessionProvider>
      </ErrorBoundary>
    </>
  );
}
