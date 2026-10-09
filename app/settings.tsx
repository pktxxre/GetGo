import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { color, layout, space, type } from '../theme/tokens';
import { useSession } from '../lib/auth';
import { fetchMyHandle } from '../lib/profile';
import { deleteAccount } from '../lib/account';
import { contactSupport } from '../lib/support';
import { BackLink } from '../components/shell/BackLink';

/**
 * The account surface — the only place `sign out` and, more importantly, `delete account` live.
 * App Store review requires an in-app delete path; the RPC + client contract shipped in 023 /
 * lib/account, but nothing could reach them until this screen. Reached from `/you`.
 *
 * Delete is a tombstone, not a cascade (023): your posted quests stay in the archive so other
 * people's rarity counts and stamped ordinals don't silently shift — that's a load-bearing
 * invariant (CLAUDE.md), and the confirm copy says so plainly rather than promising a clean
 * erase we deliberately don't do. The confirm is a second, explicit step because the action is
 * irreversible and signs you out for good. Red is never a button here (DESIGN colour rule) — the
 * destructive action is ink; the warning leans on brick `error`, never pure red.
 */
export default function SettingsScreen() {
  const { session, signOut } = useSession();
  const email = session?.user?.email ?? null;

  const [handle, setHandle] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!session) return;
    let live = true;
    fetchMyHandle()
      .then((h) => live && setHandle(h))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [session]);

  // Reached only from /you (which is signed-in), but a cold deep link could land here signed-out.
  // Send them home rather than show an account page with no account.
  useEffect(() => {
    if (!session) router.replace('/');
  }, [session]);
  if (!session) return null;

  const doSignOut = async () => {
    await signOut();
    router.replace('/');
  };

  const doDelete = async () => {
    setError(null);
    setBusy(true);
    try {
      await deleteAccount();
      router.replace('/'); // signed out server-side + locally; the feed reads as anon again
    } catch {
      setError('couldn’t delete your account — give it another go.');
      setBusy(false);
    }
  };

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <BackLink />
      <Text style={styles.title}>settings</Text>

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>SIGNED IN AS</Text>
        {handle ? <Text style={styles.identity}>@{handle}</Text> : null}
        {email ? <Text style={styles.email}>{email}</Text> : null}
      </View>

      <View style={styles.rule} />

      <Pressable onPress={doSignOut} hitSlop={8} accessibilityRole="button">
        <Text style={styles.action}>sign out</Text>
      </Pressable>

      <View style={styles.rule} />

      {/* App Store Guideline 1.2: the content policy and a published contact must be reachable. */}
      <Pressable onPress={() => router.push('/guidelines')} hitSlop={8} accessibilityRole="button">
        <Text style={styles.action}>community guidelines</Text>
      </Pressable>
      <Pressable onPress={() => contactSupport()} hitSlop={8} accessibilityRole="button">
        <Text style={styles.action}>contact us</Text>
      </Pressable>

      <View style={styles.rule} />

      {/* Delete lives at the bottom, behind a confirm — the one irreversible move on the account. */}
      {confirming ? (
        <View style={styles.confirm} accessibilityLiveRegion="polite">
          <Text style={styles.confirmTitle}>delete your account?</Text>
          <Text style={styles.confirmBody}>
            this signs you out for good and frees your handle. the quests you’ve already posted stay
            in the archive — they’re part of other people’s history — but you won’t be able to sign
            back in. there’s no undo.
          </Text>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Pressable
            style={[styles.deleteButton, busy && styles.deleteButtonDisabled]}
            disabled={busy}
            onPress={doDelete}
            accessibilityRole="button"
            accessibilityLabel="delete my account for good"
          >
            <Text style={styles.deleteLabel}>{busy ? 'deleting…' : 'delete it for good'}</Text>
          </Pressable>
          <Pressable onPress={() => setConfirming(false)} hitSlop={8} disabled={busy} accessibilityRole="button">
            <Text style={styles.keep}>keep it</Text>
          </Pressable>
        </View>
      ) : (
        <Pressable onPress={() => setConfirming(true)} hitSlop={8} accessibilityRole="button">
          <Text style={styles.danger}>delete account</Text>
        </Pressable>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: color.ground },
  content: {
    paddingTop: space.huge,
    paddingHorizontal: layout.pageMargin,
    paddingBottom: space.huge,
    gap: space.xl,
  },
  title: { ...type.detailTitle, color: color.ink, marginTop: space.md },
  section: { gap: space.sm },
  sectionLabel: { ...type.microLabel, color: color.inkMuted },
  identity: { ...type.listTitle, color: color.ink },
  email: { ...type.secondary, color: color.inkMuted },
  rule: { height: 1, backgroundColor: color.rule },
  action: { ...type.body, color: color.ink },
  danger: { ...type.body, color: color.error },
  confirm: { gap: space.lg },
  confirmTitle: { ...type.listTitle, color: color.ink },
  confirmBody: { ...type.secondary, color: color.inkMuted },
  error: { ...type.secondary, color: color.error },
  deleteButton: {
    height: 56,
    borderRadius: layout.radiusButton,
    backgroundColor: color.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteButtonDisabled: { opacity: 0.4 },
  deleteLabel: { ...type.buttonLabel, color: color.ground },
  keep: { ...type.dataLine, color: color.inkMuted, textDecorationLine: 'underline', alignSelf: 'center' },
});
