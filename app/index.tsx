import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View, Pressable } from 'react-native';
import { color, layout, space, type } from '../theme/tokens';

// The front door's text tabs (DESIGN.md → Layout → Quest list). Reads like a book index,
// not a toolbar. NOTE: `rarest` is flagged "confirm before building" in DESIGN.md → Open;
// it's shown here as a label only, no query is wired to any of these yet.
const TABS = ['what’s new', 'popular', 'rarest', 'nearby'] as const;
type Tab = (typeof TABS)[number];

export default function QuestList() {
  const [active, setActive] = useState<Tab>(TABS[0]);

  // No backend data yet — the feed comes online with the posts table + create_post RPC.
  const posts: unknown[] = [];

  return (
    <ScrollView
      style={styles.page}
      contentContainerStyle={styles.pageContent}
      showsVerticalScrollIndicator={false}
    >
      {/* One line of chrome. Scrolls away and does not come back. */}
      <View style={styles.chrome}>
        <Text style={styles.wordmark}>getgo</Text>
        <Text style={styles.cityLine}>LONDON &middot; {posts.length} SIDEQUESTS</Text>
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

      {/* Empty state. No spinners, no skeleton shimmer — a quiet mono line (DESIGN.md → Motion). */}
      {posts.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyLine}>DEVELOPING&hellip;</Text>
          <Text style={styles.emptyHint}>
            the archive is empty. first sidequests land once the feed is wired up.
          </Text>
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
