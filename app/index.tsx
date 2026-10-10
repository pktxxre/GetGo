import { useCallback, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View, Pressable, useWindowDimensions } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { color, layout, space, type } from '../theme/tokens';
import { useFeed } from '../hooks/useFeed';
import { useNearby } from '../hooks/useNearby';
import { useDelayedLoading } from '../hooks/useDelayedLoading';
import { Masonry, columnCountForWidth } from '../components/feed/Masonry';
import { TilePlaceholder } from '../components/shell/Placeholder';
import { StateScreen } from '../components/shell/StateScreen';
import { AuthSheet } from '../components/auth/AuthSheet';
import { SHELL_COPY } from '../components/shell/copy';
import { useSession } from '../lib/auth';

// The front door's text tabs (DESIGN.md → Layout → Quest list). Reads like a book index,
// not a toolbar. Only "what's new" (newest-first) is wired; the others are labels for now —
// popular/rarest need phase-2 median-relative reception XP, and `rarest` is still flagged
// "confirm before building" in DESIGN.md → Open.
const TABS = ['what’s new', 'popular', 'rarest', 'nearby'] as const;
type Tab = (typeof TABS)[number];

// Placeholder tiles vary in height so the loading grid reads like the masonry it precedes,
// not a row of identical boxes. Static — a placeholder that moves is a shimmer (banned).
const LOADING_ASPECTS = [0.72, 0.9, 0.8, 0.66, 0.84, 0.76];

export default function QuestList() {
  const [active, setActive] = useState<Tab>(TABS[0]);
  const { width } = useWindowDimensions();
  const columns = columnCountForWidth(width);

  const { session } = useSession();
  const [showAuth, setShowAuth] = useState(false);
  // The self-nav door. Signed-in → your quests; a stranger captures identity first, then lands
  // there — the same auth-at-the-moment-of-intent shape as `save it`.
  const onYouPress = () => {
    if (session?.user?.id) router.push('/you');
    else setShowAuth(true);
  };

  const feed = useFeed();
  // "nearby" is layered alongside the time feed so the default path keeps its focus-refresh.
  // It only fetches (and only prompts for location) once the nearby tab is actually selected.
  const isNearby = active === 'nearby';
  const nearby = useNearby(isNearby);

  const items = isNearby ? nearby.items : feed.items;
  const status = isNearby ? nearby.status : feed.status;
  const reload = isNearby ? nearby.reload : feed.reload;
  const refresh = feed.refresh;
  // 'idle' is nearby's pre-fetch tick; treat it as loading so there's no empty flash.
  const showLoading = useDelayedLoading(status === 'loading' || (isNearby && status === 'idle'));

  // Quietly re-fetch when the feed regains focus (e.g. back from posting), so a new post
  // shows without a placeholder flash. Skip the first focus — the initial load already ran.
  const firstFocus = useRef(true);
  useFocusEffect(
    useCallback(() => {
      if (firstFocus.current) {
        firstFocus.current = false;
        return;
      }
      refresh();
    }, [refresh]),
  );

  // A failed *time feed* load takes the whole surface — retry is the one move that can work
  // (SHELL_SPEC state matrix: Quest list · Error → StateScreen kind="failed"). A nearby failure
  // is handled inline instead, so the tabs stay reachable and the user can switch back.
  if (!isNearby && status === 'error') {
    return <StateScreen kind="failed" onPrimary={reload} />;
  }

  const countLabel = status === 'ready' ? `LONDON · ${items.length} SIDEQUESTS` : 'LONDON';

  return (
    <View style={styles.root}>
    <ScrollView
      style={styles.page}
      contentContainerStyle={styles.pageContent}
      showsVerticalScrollIndicator={false}
    >
      {/* One line of chrome. Scrolls away and does not come back. The wordmark (identity) and
          the "you" door share the top line; the city line sits under it. */}
      <View style={styles.chrome}>
        <Text style={styles.wordmark}>getgo</Text>
        <Pressable onPress={onYouPress} hitSlop={8} accessibilityRole="button" accessibilityLabel="you">
          <Text style={styles.youLink}>you</Text>
        </Pressable>
      </View>
      <Text style={styles.cityLine}>{countLabel}</Text>

      {/* Text tabs, not pills. Active gets a 2px green underline. */}
      <View style={styles.tabs}>
        {TABS.map((tab) => {
          const isActive = tab === active;
          return (
            <Pressable key={tab} onPress={() => setActive(tab)} hitSlop={8}>
              <View style={styles.tabWrap}>
                <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>{tab}</Text>
                <View style={[styles.tabUnderline, isActive && styles.tabUnderlineActive]} />
              </View>
            </Pressable>
          );
        })}
      </View>

      {status === 'ready' && items.length > 0 ? (
        <Masonry items={items} columns={columns} />
      ) : null}

      {/* Empty — its own copy, never `developing…` (S6). Loading and empty need opposite
          reactions, so they must never say the same thing (DESIGN.md → Shell States). */}
      {status === 'ready' && items.length === 0 ? (
        <View style={styles.empty} accessibilityLiveRegion="polite">
          <Text style={styles.emptyLine}>{(isNearby ? SHELL_COPY.emptyNearby : SHELL_COPY.emptyFeed).toUpperCase()}</Text>
          <Text style={styles.emptyHint}>{isNearby ? SHELL_COPY.emptyNearbyBody : SHELL_COPY.emptyFeedBody}</Text>
        </View>
      ) : null}

      {/* Nearby needs a location grant, and a nearby fetch can fail — both handled inline (not
          full-screen) so the tabs stay put. Each offers the one move that helps: grant + retry. */}
      {isNearby && (status === 'needsLocation' || status === 'error') ? (
        <View style={styles.empty} accessibilityLiveRegion="polite">
          <Text style={styles.emptyLine}>
            {(status === 'needsLocation' ? SHELL_COPY.nearbyDenied : SHELL_COPY.nearbyError).toUpperCase()}
          </Text>
          {status === 'needsLocation' ? <Text style={styles.emptyHint}>{SHELL_COPY.nearbyDeniedBody}</Text> : null}
          <Pressable onPress={reload} hitSlop={8} accessibilityRole="button">
            <Text style={styles.retry}>{SHELL_COPY.retry}</Text>
          </Pressable>
        </View>
      ) : null}

      {/* Loading — a reserved-geometry placeholder grid + one muted mono line. No shimmer. */}
      {showLoading ? (
        <View accessibilityLiveRegion="polite">
          <View style={styles.loadingRow}>
            {Array.from({ length: columns }).map((_, c) => (
              <View key={c} style={styles.loadingColumn}>
                {LOADING_ASPECTS.filter((_, i) => i % columns === c).map((aspect, i) => (
                  <TilePlaceholder key={i} aspectRatio={aspect} />
                ))}
              </View>
            ))}
          </View>
          <Text style={styles.loadingLine}>{SHELL_COPY.loading}</Text>
        </View>
      ) : null}
    </ScrollView>

      {/* The one create affordance — a pinned ink button (4px radius, not a pill), always reachable
          while the chrome above scrolls away. Ink, not a red/green FAB (DESIGN.md → colour rules). */}
      <Pressable
        style={styles.compose}
        onPress={() => router.push('/compose')}
        accessibilityRole="button"
        accessibilityLabel="post a sidequest"
      >
        <Text style={styles.composeLabel}>post a sidequest</Text>
      </Pressable>

      {/* A stranger tapping "you" captures identity here, then lands on their (empty) log. */}
      {showAuth ? (
        <AuthSheet onClose={() => setShowAuth(false)} onAuthed={() => { setShowAuth(false); router.push('/you'); }} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: color.ground,
  },
  page: {
    flex: 1,
    backgroundColor: color.ground,
  },
  pageContent: {
    paddingTop: space.huge,
    paddingHorizontal: layout.masonryMargin,
    // Clear the pinned "post a sidequest" pill (bottom xxl + 48pt tall): the last tile must
    // not sit under it. xxl + xxl + xxl ≈ pill bottom offset + pill height + a gap.
    paddingBottom: space.xxl * 3,
  },
  chrome: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: space.sm,
  },
  wordmark: {
    ...type.wordmark,
    color: color.brand, // green — identity only
  },
  youLink: {
    ...type.secondary, // matches the tab family — a nav affordance, not a stamped fact
    color: color.ink,
  },
  cityLine: {
    ...type.dataLine,
    color: color.inkMuted,
    fontVariant: ['tabular-nums'],
    marginBottom: space.xl,
  },
  tabs: {
    flexDirection: 'row',
    gap: space.lg,
    marginBottom: space.xxl,
  },
  tabWrap: {
    alignItems: 'center',
  },
  tabLabel: {
    ...type.secondary,
    color: color.inkMuted,
    paddingBottom: space.xs,
  },
  tabLabelActive: {
    color: color.ink,
  },
  tabUnderline: {
    height: 2,
    alignSelf: 'stretch',
    backgroundColor: 'transparent',
  },
  tabUnderlineActive: {
    backgroundColor: color.brand, // 2px green underline
  },
  loadingRow: {
    flexDirection: 'row',
    gap: layout.gutter,
  },
  loadingColumn: {
    flex: 1,
    gap: space.xl,
  },
  loadingLine: {
    ...type.microLabel,
    color: color.inkMuted,
    marginTop: space.xl,
  },
  empty: {
    paddingTop: space.huge,
    alignItems: 'center',
    gap: space.md,
  },
  emptyLine: {
    ...type.microLabel,
    color: color.inkMuted,
  },
  emptyHint: {
    ...type.secondary,
    color: color.inkMuted,
    textAlign: 'center',
    maxWidth: 280,
  },
  retry: {
    ...type.dataLine,
    color: color.ink,
    textDecorationLine: 'underline',
    marginTop: space.sm,
  },
  compose: {
    position: 'absolute',
    bottom: space.xxl,
    alignSelf: 'center',
    height: 48,
    paddingHorizontal: space.xl,
    // 4px, not a pill (DESIGN → Grid & radius: "buttons 4px. Nothing is a pill"). The ink fill on
    // the bone feed carries its own separation; DESIGN deletes drop shadows product-wide ("a lifted
    // card is lit paper, not a floating pane"), so no shadow — contrast does the lift.
    borderRadius: layout.radiusButton,
    backgroundColor: color.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  composeLabel: {
    ...type.buttonLabel,
    color: color.ground,
  },
});
