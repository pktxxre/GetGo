import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View, Pressable, useWindowDimensions } from 'react-native';
import { color, layout, space, type } from '../theme/tokens';
import { useFeed } from '../hooks/useFeed';
import { useDelayedLoading } from '../hooks/useDelayedLoading';
import { Masonry, columnCountForWidth } from '../components/feed/Masonry';
import { TilePlaceholder } from '../components/shell/Placeholder';
import { StateScreen } from '../components/shell/StateScreen';
import { SHELL_COPY } from '../components/shell/copy';

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

  const { items, status, reload } = useFeed();
  const showLoading = useDelayedLoading(status === 'loading');

  // A failed load takes the whole surface — retry is the one move that can work here
  // (SHELL_SPEC state matrix: Quest list · Error → StateScreen kind="failed").
  if (status === 'error') {
    return <StateScreen kind="failed" onPrimary={reload} />;
  }

  const countLabel = status === 'ready' ? `LONDON · ${items.length} SIDEQUESTS` : 'LONDON';

  return (
    <ScrollView
      style={styles.page}
      contentContainerStyle={styles.pageContent}
      showsVerticalScrollIndicator={false}
    >
      {/* One line of chrome. Scrolls away and does not come back. */}
      <View style={styles.chrome}>
        <Text style={styles.wordmark}>getgo</Text>
        <Text style={styles.cityLine}>{countLabel}</Text>
      </View>

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
          <Text style={styles.emptyLine}>{SHELL_COPY.emptyFeed.toUpperCase()}</Text>
          <Text style={styles.emptyHint}>{SHELL_COPY.emptyFeedBody}</Text>
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
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: color.ground,
  },
  pageContent: {
    paddingTop: space.huge,
    paddingHorizontal: layout.masonryMargin,
    paddingBottom: space.xxl,
  },
  chrome: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: space.xl,
  },
  wordmark: {
    ...type.wordmark,
    color: color.brand, // green — identity only
  },
  cityLine: {
    ...type.dataLine,
    color: color.inkMuted,
    fontVariant: ['tabular-nums'],
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
});
