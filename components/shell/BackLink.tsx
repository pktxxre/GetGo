import { Pressable, StyleSheet, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { color, type } from '../../theme/tokens';

type Props = {
  /** where to go when there's no history to pop — a deep link's common case. */
  fallback?: string;
  label?: string;
};

/**
 * The one back control. Headers are off globally (DESIGN.md deletes chrome), so native has
 * no system back — this is it. `router.canGoBack()` is the whole point: a TikTok deep link
 * into a quest detail has NO history, and that's the common arrival path, not an edge case,
 * so a bare `router.back()` would dead-end. Renders `← BACK` in mono, full ink, never over
 * an image.
 */
export function BackLink({ fallback = '/', label = 'back' }: Props) {
  const router = useRouter();
  const onPress = () => {
    if (router.canGoBack()) router.back();
    else router.replace(fallback);
  };

  return (
    <Pressable
      onPress={onPress}
      hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
      accessibilityRole="button"
      accessibilityLabel="go back"
    >
      <Text style={styles.label}>{`← ${label.toUpperCase()}`}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  label: {
    ...type.dataLine,
    color: color.ink,
  },
});
