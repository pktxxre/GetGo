import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { color, layout, space, type } from '../../theme/tokens';
import { BackLink } from './BackLink';
import { STATE_COPY, type StateKind } from './copy';

type Props = {
  kind: StateKind;
  /** override the default body sentence. */
  body?: string;
  /** the retry handler — only meaningful for `failed`, the one kind where retrying works. */
  onPrimary?: () => void;
};

/**
 * Full-page message state. Three kinds, one component (SHELL_SPEC → StateScreen):
 *   notFound — no retry; the thing isn't there, retrying can't summon it.
 *   failed   — retry (onPrimary) plus an escape to the front door; the network might work now.
 *   crashed  — no retry; a render threw, the only sane move is a fresh front door.
 *
 * Invariant: retry is offered ONLY where retrying can work. notFound and crashed have none.
 */
export function StateScreen({ kind, body, onPrimary }: Props) {
  const router = useRouter();
  const { height } = useWindowDimensions();
  const copy = STATE_COPY[kind];

  const stampColor = kind === 'notFound' ? color.inkMuted : color.error;
  const goHome = () => router.replace('/');

  // Primary action per kind. failed retries; the others go home.
  const onPrimaryPress = kind === 'failed' ? onPrimary : goHome;
  // Only failed has a secondary escape distinct from its primary.
  const showEscape = kind === 'failed';

  return (
    <View
      style={[styles.page, height >= 720 ? styles.top : styles.centered]}
      accessibilityLiveRegion="polite"
      role="alert"
    >
      <BackLink />

      <View style={styles.block}>
        <Text style={[styles.stamp, { color: stampColor }]}>{copy.stamp.toUpperCase()}</Text>
        <Text style={styles.title}>{copy.title}</Text>
        <Text style={styles.body}>{body ?? copy.body}</Text>

        <Pressable
          style={styles.primary}
          onPress={onPrimaryPress}
          accessibilityRole="button"
          accessibilityLabel={copy.primaryLabel}
        >
          <Text style={styles.primaryLabel}>{copy.primaryLabel}</Text>
        </Pressable>

        {showEscape && copy.escapeLabel ? (
          <Pressable onPress={goHome} accessibilityRole="button" accessibilityLabel={copy.escapeLabel}>
            <Text style={styles.escape}>{copy.escapeLabel}</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: color.ground,
    paddingHorizontal: layout.pageMargin,
    paddingTop: space.huge,
  },
  top: {
    justifyContent: 'flex-start',
  },
  centered: {
    justifyContent: 'center',
  },
  block: {
    maxWidth: 320, // ~34ch ragged-left column
    gap: space.md,
    marginTop: space.xxl,
  },
  stamp: {
    ...type.microLabel,
  },
  title: {
    ...type.detailTitle,
    color: color.ink,
  },
  body: {
    ...type.secondary,
    color: color.inkMuted,
  },
  primary: {
    marginTop: space.xl,
    minHeight: 48,
    alignSelf: 'flex-start',
    justifyContent: 'center',
    paddingHorizontal: space.xl,
    backgroundColor: color.ink, // ink, never red — a CTA is ink (DESIGN.md)
    borderRadius: layout.radiusButton,
  },
  primaryLabel: {
    ...type.buttonLabel,
    color: color.ground,
  },
  escape: {
    ...type.dataLine,
    color: color.inkMuted,
    textDecorationLine: 'underline',
  },
});
