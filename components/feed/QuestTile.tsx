import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { color, layout, space, type } from '../../theme/tokens';
import type { FeedItem } from '../../lib/feed';
import { formatOrdinal } from '../../lib/format';

/**
 * One masonry tile: photo → caption → mono fact line (DESIGN.md → Quest list).
 *
 * The caption is the sell, not metadata — full ink, never muted, never clamped (the
 * surprise is often in the last clause). The fact line is `<ORDINAL> · <NEIGHBOURHOOD>`;
 * only the ordinal is red — the one fact Pinterest structurally can't show. Postcode and
 * cost from the DESIGN mock aren't columns in the locked v1 schema, so the line carries what
 * exists: rarity ordinal + where.
 *
 * No icons, no avatar, no timestamp, no save button here — the front door is deliberately
 * icon-free (DESIGN "Icon count on the quest list: zero"); `save it` lives on quest detail.
 */
export function QuestTile({ item }: { item: FeedItem }) {
  const router = useRouter();
  return (
    <Pressable
      style={styles.tile}
      onPress={() => router.push(`/quest/${item.id}`)}
      accessibilityRole="button"
      accessibilityLabel={item.caption ?? 'open quest'}
    >
      {item.photo ? (
        <Image
          source={{ uri: item.photo.uri }}
          style={[styles.photo, { aspectRatio: item.photo.aspectRatio }]}
          resizeMode="cover"
          // The photo IS the content; describe it by its caption for screen readers.
          accessibilityRole="image"
          accessibilityLabel={item.caption ?? undefined}
        />
      ) : (
        <View style={[styles.photo, styles.photoMissing]} />
      )}

      {item.caption ? <Text style={styles.caption}>{item.caption}</Text> : null}

      <Text style={styles.fact} numberOfLines={1}>
        {item.ordinal != null ? <Text style={styles.ordinal}>{formatOrdinal(item.ordinal)}</Text> : null}
        {item.ordinal != null && item.neighbourhood ? <Text style={styles.sep}>{'  ·  '}</Text> : null}
        {item.neighbourhood ? <Text style={styles.place}>{item.neighbourhood.toUpperCase()}</Text> : null}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: {
    gap: space.sm,
  },
  photo: {
    width: '100%',
    borderRadius: layout.radiusPhoto,
    backgroundColor: color.rule, // bone fill shows while the image loads — no shimmer
  },
  photoMissing: {
    aspectRatio: 0.8,
  },
  caption: {
    ...type.tileCaption,
    color: color.ink, // full ink — never muted (DESIGN.md)
  },
  fact: {
    ...type.dataLine,
    fontVariant: ['tabular-nums'],
  },
  ordinal: {
    ...type.dataLine,
    color: color.mark, // red — rarity only, the one fact the grid makes comparable
  },
  sep: {
    ...type.dataLine,
    color: color.inkMuted,
  },
  place: {
    ...type.dataLine,
    color: color.inkMuted,
  },
});
