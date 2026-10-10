import { Image, StyleSheet, View, type ImageProps, type StyleProp, type ViewStyle } from 'react-native';
import { color, grade } from '../theme/tokens';

/**
 * The one place the system-wide image grade lives (DESIGN.md → Image grade). Every photo on every
 * surface renders through this, never a bare <Image> — the grade is quality control on amateur
 * UGC, not decoration, so it can't be optional or per-call. It composes three layers over the photo:
 *   - desaturation via the RN `filter` style (−6%, `grade.saturate`)
 *   - a faint warm overlay (+3 warmth, `grade.warmth`) — filters have no colour-temperature knob
 *   - 4% monochrome grain: a tiled grayscale noise texture (assets/noise.png, `grade.grain`)
 *
 * The passed `style` (dimensions, aspectRatio, borderRadius, the bone load-fill) sits on the
 * wrapper; the image absolutely fills it and the grade layers sit on top, so the caller swaps
 * <Image> → <GradedImage> with the exact same style and nothing reflows.
 */
// Static require so Metro bundles the texture; tiled across the photo via resizeMode="repeat".
const NOISE = require('../assets/noise.png');
type Props = Omit<ImageProps, 'style'> & { style?: StyleProp<ViewStyle> };

export function GradedImage({ style, resizeMode = 'cover', ...imageProps }: Props) {
  return (
    <View style={[styles.wrap, style]}>
      <Image {...imageProps} resizeMode={resizeMode} style={styles.image} />
      {/* Warm wash, then grain — both above the photo, neither intercepts the tile's tap. */}
      <View pointerEvents="none" style={styles.warm} />
      {/* Grain is a bare Image (no handler), so it doesn't claim the tile's touch responder. */}
      <Image source={NOISE} resizeMode="repeat" style={styles.grain} />
    </View>
  );
}

const fill = { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 } as const;

const styles = StyleSheet.create({
  wrap: {
    overflow: 'hidden', // clip the image + overlay to the wrapper's borderRadius
    backgroundColor: color.rule, // bone fill shows while the image loads — no shimmer
  },
  image: {
    ...fill,
    // −6% saturation. RN 0.86 (New Arch) applies `filter` on iOS + Android; web may no-op, which
    // degrades to the warm overlay only — acceptable, native is the ship target.
    filter: [{ saturate: grade.saturate }],
  },
  warm: {
    ...fill,
    backgroundColor: grade.warmth,
  },
  grain: {
    ...fill,
    width: '100%',
    height: '100%',
    opacity: grade.grain, // 4% monochrome grain, tiled over the photo
  },
});
