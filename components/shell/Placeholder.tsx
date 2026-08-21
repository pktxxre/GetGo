import { StyleSheet, View, type DimensionValue } from 'react-native';
import { color, layout, space } from '../../theme/tokens';

// Bone placeholder fill. DESIGN.md/SHELL_SPEC name #E9E2D5; the shell adds zero new tokens,
// so we use `rule`, the nearest defined bone-family value. A static block — no motion, no
// gradient, no shimmer of any kind (banned by DESIGN.md → Motion). Loading is a reserved
// rectangle, not a light show.
const BONE = color.rule;

type PlaceholderProps = {
  width?: DimensionValue;
  height?: DimensionValue;
  /** width / height; when set, reserves height from width so nothing reflows on paint. */
  aspectRatio?: number;
  radius?: number;
};

export function Placeholder({ width = '100%', height, aspectRatio, radius = layout.radiusPhoto }: PlaceholderProps) {
  return (
    <View
      style={[styles.block, { width, height, aspectRatio, borderRadius: radius }]}
      // Placeholders are invisible to screen readers — loading is announced as text
      // elsewhere, not as a pile of empty views.
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    />
  );
}

/**
 * A tile-shaped placeholder: photo block at the given aspect ratio, then two caption lines
 * and one fact line — matching the real tile's geometry so the masonry doesn't jump when
 * real content paints over it.
 */
export function TilePlaceholder({ aspectRatio = 0.8 }: { aspectRatio?: number }) {
  return (
    <View style={styles.tile}>
      <Placeholder aspectRatio={aspectRatio} />
      <Placeholder width="90%" height={12} radius={2} />
      <Placeholder width="60%" height={12} radius={2} />
      <Placeholder width="40%" height={10} radius={2} />
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    backgroundColor: BONE,
  },
  tile: {
    gap: space.sm,
  },
});
