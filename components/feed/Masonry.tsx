import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { color, layout, space } from '../../theme/tokens';
import type { FeedItem } from '../../lib/feed';
import { QuestTile } from './QuestTile';

/**
 * 2-column masonry (3 at ≥720, 4 at ≥1024 — DESIGN.md → Grid & radius). The column split is
 * computed once from each tile's known aspect ratio and never recomputed on scroll, so the
 * grid lays out its final shape on the first paint: "the masonry must never move after paint"
 * (DESIGN.md → Motion) is a layout guarantee here, not a hope.
 *
 * Packing is greedy shortest-column: each tile lands in whichever column is currently
 * shortest. Height is estimated from the photo's aspect ratio plus a flat allowance for the
 * caption/fact block — exact enough to balance, and balance is cosmetic; correctness is that
 * the assignment is fixed before render.
 */
export function columnCountForWidth(width: number): number {
  if (width >= 1024) return 4;
  if (width >= 720) return 3;
  return 2;
}

// Rough non-photo height (caption + fact) as a fraction of column width, for balancing only.
const TEXT_ALLOWANCE = 0.55;

export function assignColumns(items: FeedItem[], columns: number): FeedItem[][] {
  const cols: FeedItem[][] = Array.from({ length: columns }, () => []);
  const heights = new Array(columns).fill(0);

  for (const item of items) {
    const aspect = item.photo?.aspectRatio ?? 0.8;
    const weight = 1 / aspect + TEXT_ALLOWANCE; // taller photo (smaller aspect) → larger weight
    let shortest = 0;
    for (let c = 1; c < columns; c++) if (heights[c] < heights[shortest]) shortest = c;
    cols[shortest].push(item);
    heights[shortest] += weight;
  }
  return cols;
}

export function Masonry({ items, columns }: { items: FeedItem[]; columns: number }) {
  const cols = useMemo(() => assignColumns(items, columns), [items, columns]);

  return (
    <View style={styles.row}>
      {cols.map((colItems, c) => (
        <View key={c} style={styles.column}>
          {colItems.map((item) => (
            <QuestTile key={item.id} item={item} />
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: layout.gutter,
  },
  column: {
    flex: 1,
    gap: space.xl, // vertical rhythm between tiles; spacious around photographs
    // The two accents never sit adjacent; the column is just bone ground between tiles.
    backgroundColor: color.ground,
  },
});
