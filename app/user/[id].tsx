import { View, ScrollView, StyleSheet, Text, useWindowDimensions } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { color, layout, space, type } from '../../theme/tokens';
import { useUserPosts } from '../../hooks/useUserPosts';
import { useDelayedLoading } from '../../hooks/useDelayedLoading';
import { Masonry, columnCountForWidth } from '../../components/feed/Masonry';
import { TilePlaceholder } from '../../components/shell/Placeholder';
import { StateScreen } from '../../components/shell/StateScreen';
import { BackLink } from '../../components/shell/BackLink';
import { SHELL_COPY } from '../../components/shell/copy';

/**
 * A user's quests — the completed sidequests one person has posted, newest first. Reached by
 * tapping a byline (their own or anyone's); the feed's RLS decides visibility, so your own
 * page shows your private posts and a stranger's shows only their public ones (lib/feed
 * fetchUserPosts). Built entirely from the feed's existing masonry + state components — no new
 * visual language — so it reads as the same product, just scoped to one author.
 */
const LOADING_ASPECTS = [0.72, 0.9, 0.8, 0.66, 0.84, 0.76];

export default function UserQuests() {
  const params = useLocalSearchParams<{ id: string; handle?: string }>();
  const { width } = useWindowDimensions();
  const columns = columnCountForWidth(width);

  const { items, status, reload } = useUserPosts(params.id);
  const showLoading = useDelayedLoading(status === 'loading');

  // A retry takes the whole surface — the one move that can work on a failed load.
  if (status === 'error') return <StateScreen kind="failed" onPrimary={reload} />;

  // The handle names the page. Prefer the route param (present on a byline tap); fall back to a
  // fetched post's author once loaded, so a cold deep link still titles correctly.
  const handle = params.handle ?? items[0]?.handle ?? null;

  return (
    <ScrollView
      style={styles.page}
      contentContainerStyle={styles.pageContent}
      showsVerticalScrollIndicator={false}
    >
      <BackLink />
      <Text style={styles.title}>{handle ? `@${handle}` : 'quests'}</Text>

      {status === 'ready' && items.length > 0 ? <Masonry items={items} columns={columns} /> : null}

      {status === 'ready' && items.length === 0 ? (
        <View style={styles.empty} accessibilityLiveRegion="polite">
          <Text style={styles.emptyLine}>{SHELL_COPY.emptyUser.toUpperCase()}</Text>
          <Text style={styles.emptyHint}>{SHELL_COPY.emptyUserBody}</Text>
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
  title: { ...type.detailTitle, color: color.ink, marginTop: space.md, marginBottom: space.xxl },
  loadingRow: { flexDirection: 'row', gap: layout.gutter },
  loadingColumn: { flex: 1, gap: space.xl },
  loadingLine: { ...type.microLabel, color: color.inkMuted, marginTop: space.xl },
  empty: { paddingTop: space.huge, alignItems: 'center', gap: space.md },
  emptyLine: { ...type.microLabel, color: color.inkMuted },
  emptyHint: { ...type.secondary, color: color.inkMuted, textAlign: 'center', maxWidth: 280 },
});
