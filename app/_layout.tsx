import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts, Fraunces_400Regular, Fraunces_500Medium } from '@expo-google-fonts/fraunces';
import { SchibstedGrotesk_400Regular, SchibstedGrotesk_600SemiBold } from '@expo-google-fonts/schibsted-grotesk';
import { MartianMono_500Medium } from '@expo-google-fonts/martian-mono';
import { View } from 'react-native';
import { color } from '../theme/tokens';
import { ErrorBoundary } from '../components/shell/ErrorBoundary';
import { OfflineBanner } from '../components/shell/OfflineBanner';
import { SessionProvider } from '../lib/auth';

// Keep the native splash up until the typefaces are ready — without this the first paint lands
// in system SF and visibly reflows to Fraunces/Schibsted/Martian Mono once they load. The keys
// here MUST match theme/tokens.ts `font` exactly, or a fontFamily silently falls back to SF.
SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Fraunces_400Regular,
    Fraunces_500Medium,
    SchibstedGrotesk_400Regular,
    SchibstedGrotesk_600SemiBold,
    MartianMono_500Medium,
  });

  useEffect(() => {
    // Reveal once fonts are in — or if they failed, so a font CDN hiccup never bricks launch
    // (the app degrades to system fonts rather than an eternal splash).
    if (fontsLoaded || fontError) SplashScreen.hideAsync().catch(() => {});
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null; // splash stays up; nothing renders in SF

  return (
    <>
      <StatusBar style="dark" />
      {/* One boundary over the whole nav tree: a render error anywhere shows `crashed`
          instead of a white screen, and resets on route change (S5). */}
      <ErrorBoundary>
        {/* Auth session is app-wide: the feed reads as anon, a save prompts for identity. */}
        <SessionProvider>
          {/* Banner above the Stack: losing signal keeps the loaded content and slides a strip
              in, rather than blanking the screen (SHELL_SPEC S7). */}
          <View style={{ flex: 1, backgroundColor: color.ground }}>
            <OfflineBanner />
            <Stack
              screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: color.ground },
                // No dark mode at launch — one ground, done properly (DESIGN.md).
                animation: 'fade',
              }}
            />
          </View>
        </SessionProvider>
      </ErrorBoundary>
    </>
  );
}
