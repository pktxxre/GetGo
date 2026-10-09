import { useEffect, useState } from 'react';
import { Pressable, View, ScrollView, StyleSheet, Text, useWindowDimensions } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { color, layout, space, type } from '../../theme/tokens';
import { useSession } from '../../lib/auth';
import { blockUser, unblockUser, fetchIsBlocked } from '../../lib/blocks';
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

  const { session } = useSession();
  const { items, status, reload } = useUserPosts(params.id);
  const showLoading = useDelayedLoading(status === 'loading');

  // Block state (Guideline 1.2). Blocking is offered only to a signed-in visitor looking at
  // someone else's profile — never your own, never signed-out (RLS would reject it anyway).
  const me = session?.user?.id ?? null;
  const canBlock = me != null && me !== params.id;
  const [blocked, setBlocked] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [blockError, setBlockError] = useState<string | null>(null);

  useEffect(() => {
    if (!canBlock || !me) return;
    let live = true;
    fetchIsBlocked(me, params.id)
      .then((b) => live && setBlocked(b))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [canBlock, me, params.id]);

  // A retry takes the whole surface — the one move that can work on a failed load.
  if (status === 'error') return <StateScreen kind="failed" onPrimary={reload} />;

  // The handle names the page. Prefer the route param (present on a byline tap); fall back to a
  // fetched post's author once loaded, so a cold deep link still titles correctly.
  const handle = params.handle ?? items[0]?.handle ?? null;
  const named = handle ? `@${handle}` : 'them';

  const doBlock = async () => {
    if (!me) return;
    setBlockError(null);
    setBusy(true);
    try {
      await blockUser(me, params.id);
      setBlocked(true);
      setConfirming(false);
      reload(); // their posts drop out of your feed everywhere; this page reflects it too
    } catch {
      setBlockError('couldn’t block — give it another go.');
    } finally {
      setBusy(false);
    }
  };

  const doUnblock = async () => {
    if (!me) return;
    setBlockError(null);
    setBusy(true);
    try {
      await unblockUser(me, params.id);
      setBlocked(false);
      reload();
    } catch {
      setBlockError('couldn’t unblock — give it another go.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView
      style={styles.page}
      contentContainerStyle={styles.pageContent}
      showsVerticalScrollIndicator={false}
    >
      <BackLink />
      <Text style={styles.title}>{handle ? `@${handle}` : 'quests'}</Text>

      {/* Block / unblock (Guideline 1.2). Understated ink — never red (DESIGN colour rule). */}
      {canBlock ? (
        <View style={styles.blockRow} accessibilityLiveRegion="polite">
          {blocked ? (
            <View style={styles.blockedState}>
              <Text style={styles.blockedNote}>you blocked {named} — their quests are hidden from you.</Text>
              <Pressable onPress={doUnblock} hitSlop={8} disabled={busy} accessibilityRole="button">
                <Text style={styles.blockAction}>{busy ? 'unblocking…' : 'unblock'}</Text>
              </Pressable>
            </View>
          ) : confirming ? (
            <View style={styles.confirm}>
              <Text style={styles.confirmBody}>stop seeing {named}’s quests? you can unblock any time.</Text>
              <Pressable onPress={doBlock} hitSlop={8} disabled={busy} accessibilityRole="button" accessibilityLabel={`block ${named}`}>
                <Text style={styles.blockAction}>{busy ? 'blocking…' : 'block them'}</Text>
              </Pressable>
              <Pressable onPress={() => setConfirming(false)} hitSlop={8} disabled={busy} accessibilityRole="button">
                <Text style={styles.blockCancel}>never mind</Text>
              </Pressable>
            </View>
          ) : (
            <Pressable onPress={() => setConfirming(true)} hitSlop={8} accessibilityRole="button">
              <Text style={styles.blockLink}>block {named}</Text>
            </Pressable>
          )}
          {blockError ? <Text style={styles.blockErrorText}>{blockError}</Text> : null}
        </View>
      ) : null}

      {/* When you've blocked someone, their grid is deliberately not shown (nor its "no quests
          yet" empty copy, which would misread as "they have none"). The status above is the page. */}
      {!blocked ? (
        <>
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
        </>
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
  title: { ...type.detailTitle, color: color.ink, marginTop: space.md, marginBottom: space.lg },
  blockRow: { marginBottom: space.xxl, gap: space.sm },
  blockedState: { gap: space.sm },
  blockedNote: { ...type.secondary, color: color.inkMuted },
  confirm: { gap: space.sm },
  confirmBody: { ...type.secondary, color: color.inkMuted },
  blockLink: { ...type.secondary, color: color.inkMuted, textDecorationLine: 'underline' },
  blockAction: { ...type.body, color: color.ink },
  blockCancel: { ...type.secondary, color: color.inkMuted },
  blockErrorText: { ...type.secondary, color: color.error },
  loadingRow: { flexDirection: 'row', gap: layout.gutter },
  loadingColumn: { flex: 1, gap: space.xl },
  loadingLine: { ...type.microLabel, color: color.inkMuted, marginTop: space.xl },
  empty: { paddingTop: space.huge, alignItems: 'center', gap: space.md },
  emptyLine: { ...type.microLabel, color: color.inkMuted },
  emptyHint: { ...type.secondary, color: color.inkMuted, textAlign: 'center', maxWidth: 280 },
});
