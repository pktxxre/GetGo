import { useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { color, space, type } from '../../theme/tokens';
import { SHELL_COPY } from './copy';

/**
 * The one connection surface (SHELL_SPEC S7). Losing signal mid-scroll used to blank whatever was
 * loaded; this keeps the content and slides a thin strip in instead. A brick (`color.error`) strip
 * with bone mono text — brick, never pure red (red is the rarity mark, DESIGN colour rule). Mounted
 * once in `_layout.tsx` above the Stack; renders `null` while connected.
 *
 * The committed state is **debounced 2s** so a brief flap (a tunnel, a lift) neither flashes the
 * banner nor re-announces it via the live region — the connection has to actually settle before the
 * strip appears or disappears. `isConnected === false` is the only offline signal; `null` (unknown)
 * is treated as connected, so we never cry wolf on an indeterminate state.
 *
 * `@react-native-community/netinfo` covers web too (navigator.onLine + online/offline events). The
 * subscription lives in an effect, so it never runs during web static prerender; the extra SSR
 * guard is belt-and-braces.
 */
export function OfflineBanner() {
  const [offline, setOffline] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (Platform.OS === 'web' && typeof window === 'undefined') return; // web SSR: no window

    const unsub = NetInfo.addEventListener((state) => {
      const connected = state.isConnected !== false; // null (unknown) counts as connected
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setOffline(!connected), 2000); // flap debounce
    });

    return () => {
      if (timer.current) clearTimeout(timer.current);
      unsub();
    };
  }, []);

  if (!offline) return null;

  return (
    <View style={styles.banner} accessibilityLiveRegion="polite" accessibilityRole="alert">
      <Text style={styles.label}>{SHELL_COPY.offline.toUpperCase()}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    width: '100%',
    backgroundColor: color.error, // brick — not pure red (DESIGN: red is the rarity mark only)
    paddingVertical: space.sm,
    alignItems: 'center',
  },
  label: {
    ...type.microLabel, // mono 10 / .12em
    color: color.ground,
  },
});
