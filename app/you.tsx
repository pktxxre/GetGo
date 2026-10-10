import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { router } from 'expo-router';
import { color, layout, space, type } from '../theme/tokens';
import { useSession } from '../lib/auth';
import { fetchMyHandle } from '../lib/profile';
import { useUserPosts } from '../hooks/useUserPosts';
import { useSavedQuests } from '../hooks/useSavedQuests';
import { useDelayedLoading } from '../hooks/useDelayedLoading';
import { Masonry, columnCountForWidth } from '../components/feed/Masonry';
import { TilePlaceholder } from '../components/shell/Placeholder';
import { StateScreen } from '../components/shell/StateScreen';
import { BackLink } from '../components/shell/BackLink';
import { AuthSheet } from '../components/auth/AuthSheet';
import { SHELL_COPY } from '../components/shell/copy';

/**
 * Your own quests + saved log — the self-profile the feed had no door to. You reach anyone
 * else's page by tapping a byline, but there was never a "me" entry, so your own posts, your
 * saved collection, and (deliberately) the only route to `delete_account` were all unreachable.
 * The front door's "you" link lands here.
 *
 * Two text tabs, same shape as the front door: **quests** (what you've posted) and **saved**
 * (what you've saved to do). Both reuse the feed's grid + state components — no new visual
 * language. RLS means "quests" shows your private posts too (you're the author) without an
 * `is this me?` branch; "saved" is scoped by `saves_own_read`. A signed-out cold deep link gets
 * the auth sheet, then the grid fills in once the session context updates.
 */
const TABS = ['quests', 'saved'] as const;
type Tab = (typeof TABS)[number];

const LOADING_ASPECTS = [0.72, 0.9, 0.8, 0.66, 0.84, 0.76];

export default function YouScreen() {
  const { session } = useSession();
  const uid = session?.user?.id;
  const { width } = useWindowDimensions();
  const columns = columnCountForWidth(width);

  const [active, setActive] = useState<Tab>(TABS[0]);
  const quests = useUserPosts(uid);
  // Saved loads lazily — only once you actually open the saved tab (mirrors nearby).
  const saved = useSavedQuests(uid, active === 'saved');

  const isSaved = active === 'saved';
  const items = isSaved ? saved.items : quests.items;
  const status = isSaved ? saved.status : quests.status;
  const reload = isSaved ? saved.reload : quests.reload;
  // 'idle' is saved's pre-fetch tick; treat it as loading so there's no empty flash.
  const showLoading = useDelayedLoading(status === 'loading' || (isSaved && status === 'idle'));

  // Title with your handle. Prefer a direct lookup (covers the empty-log case), fall back to a
  // fetched post's author.
  const [handle, setHandle] = useState<string | null>(null);
  useEffect(() => {
    if (!uid) return;
    let live = true;
    fetchMyHandle()
      .then((h) => live && setHandle(h))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [uid]);

  // No session (a cold deep link to /you) — capture identity, then the grid renders itself once
  // the session context updates. Closing goes home rather than dead-ending on a blank page.
  if (!uid) {
    return <AuthSheet onClose={() => router.replace('/')} onAuthed={() => {}} />;
  }

  if (status === 'error') return <StateScreen kind="failed" onPrimary={reload} />;

  const title = handle ?? quests.items[0]?.handle ?? null;
  const emptyLine = isSaved ? SHELL_COPY.emptySaved : SHELL_COPY.emptySelf;
  const emptyBody = isSaved ? SHELL_COPY.emptySavedBody : SHELL_COPY.emptySelfBody;

  return (
    <ScrollView
      style={styles.page}
      contentContainerStyle={styles.pageContent}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.topRow}>
        <BackLink />
        <Pressable
          onPress={() => router.push('/settings')}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="settings"
        >
          <Text style={styles.settingsLink}>settings</Text>
        </Pressable>
      </View>

      <Text style={styles.title}>{title ? `@${title}` : 'your quests'}</Text>

      {/* Text tabs, same idiom as the front door: active gets a 2px green underline. */}
      <View style={styles.tabs}>
        {TABS.map((tab) => {
          const tabActive = tab === active;
          return (
            <Pressable key={tab} onPress={() => setActive(tab)} hitSlop={8}>
              <View style={styles.tabWrap}>
                <Text style={[styles.tabLabel, tabActive && styles.tabLabelActive]}>{tab}</Text>
                <View style={[styles.tabUnderline, tabActive && styles.tabUnderlineActive]} />
              </View>
            </Pressable>
          );
        })}
      </View>

      {status === 'ready' && items.length > 0 ? <Masonry items={items} columns={columns} /> : null}

      {status === 'ready' && items.length === 0 ? (
        <View style={styles.empty} accessibilityLiveRegion="polite">
          <Text style={styles.emptyLine}>{emptyLine.toUpperCase()}</Text>
          <Text style={styles.emptyHint}>{emptyBody}</Text>
        </View>
      ) : null}

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
  page: { flex: 1, backgroundColor: color.ground },
  pageContent: {
    paddingTop: space.huge,
    paddingHorizontal: layout.masonryMargin,
    paddingBottom: space.xxl,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  settingsLink: { ...type.dataLine, color: color.ink },
  title: { ...type.detailTitle, color: color.ink, marginTop: space.md, marginBottom: space.xl },
  tabs: { flexDirection: 'row', gap: space.lg, marginBottom: space.xxl },
  tabWrap: { alignItems: 'center' },
  tabLabel: { ...type.secondary, color: color.inkMuted, paddingBottom: space.xs },
  tabLabelActive: { color: color.ink },
  tabUnderline: { height: 2, alignSelf: 'stretch', backgroundColor: 'transparent' },
  tabUnderlineActive: { backgroundColor: color.brand },
  loadingRow: { flexDirection: 'row', gap: layout.gutter },
  loadingColumn: { flex: 1, gap: space.xl },
  loadingLine: { ...type.microLabel, color: color.inkMuted, marginTop: space.xl },
  empty: { paddingTop: space.huge, alignItems: 'center', gap: space.md },
  emptyLine: { ...type.microLabel, color: color.inkMuted },
  emptyHint: { ...type.secondary, color: color.inkMuted, textAlign: 'center', maxWidth: 280 },
});
