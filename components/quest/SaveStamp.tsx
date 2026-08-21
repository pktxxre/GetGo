import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, Easing } from 'react-native';
import { color, layout, space, type } from '../../theme/tokens';
import { formatStampDate, seededAngle } from '../../lib/format';
import { useReducedMotion } from '../../hooks/useReducedMotion';

/**
 * The save stamp — the entire delight budget, 140ms (DESIGN.md → Motion). A vermilion
 * `SAVED · 12 AUG` lands on the stamp block, rotated at a seeded angle unique to the quest,
 * scaling 1.06 → 1.00, opacity 0 → 1, ease-out. "It lands crooked and stays crooked." The
 * button doesn't animate; this does. Reduced motion → it simply appears at rest, no overshoot.
 *
 * Red here is sanctioned: DESIGN's two-accent rule names the `saved` stamp (with the rarity
 * ordinal) as the mark's only homes.
 */
export function SaveStamp({ questId, date = new Date() }: { questId: string; date?: Date }) {
  const reduced = useReducedMotion();
  const angle = seededAngle(questId);
  const progress = useRef(new Animated.Value(reduced ? 1 : 0)).current;

  useEffect(() => {
    if (reduced) {
      progress.setValue(1);
      return;
    }
    Animated.timing(progress, {
      toValue: 1,
      duration: 140,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    }).start();
  }, [progress, reduced]);

  const scale = progress.interpolate({ inputRange: [0, 1], outputRange: [1.06, 1] });

  return (
    <Animated.View
      pointerEvents="none"
      accessibilityLabel={`saved ${formatStampDate(date)}`}
      style={[
        styles.stamp,
        { opacity: progress, transform: [{ rotate: `${angle}deg` }, { scale }] },
      ]}
    >
      <Text style={styles.label}>SAVED · {formatStampDate(date)}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  stamp: {
    position: 'absolute',
    top: -space.md,
    right: space.lg,
    paddingHorizontal: space.sm,
    paddingVertical: space.xs,
    borderWidth: 2,
    borderColor: color.mark, // vermilion — the sanctioned second home of the mark
    borderRadius: layout.radiusStamp,
    backgroundColor: color.surface,
  },
  label: {
    ...type.dataLine,
    color: color.mark,
  },
});
