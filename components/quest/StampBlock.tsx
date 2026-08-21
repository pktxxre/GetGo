import { StyleSheet, Text, View } from 'react-native';
import { color, layout, space, type } from '../../theme/tokens';
import { costLabel, ordinalize, tierLabel } from '../../lib/format';

/**
 * The stamp block (DESIGN.md → Quest detail): a `--surface` rectangle, 1px `--rule` border,
 * split 2×2 by internal hairlines — the back of a ticket. Each cell is a mono micro-label
 * over a Fraunces value. Only the RARITY value is red (the one fact Pinterest can't show);
 * everything else is ink.
 *
 * "This block replaces every badge, chip, XP counter, level and progress ring in the
 * product" — it is the same artifact whether or not the viewer has an account, so no
 * gamified chrome ever has to be bolted on. An unset axis renders an em-dash, never a guess.
 */
type Props = {
  effort: number | null;
  nerve: number | null;
  costPence: number | null;
  /** completion_ordinal — the stamped rarity mark. */
  ordinal: number | null;
};

export function StampBlock({ effort, nerve, costPence, ordinal }: Props) {
  return (
    <View style={styles.block} accessibilityLabel="quest stamp block">
      <View style={styles.row}>
        <Cell label="effort" value={tierLabel(effort)} borderRight borderBottom />
        <Cell label="nerve" value={tierLabel(nerve)} borderBottom />
      </View>
      <View style={styles.row}>
        <Cell label="cost" value={costLabel(costPence)} borderRight />
        <Cell label="rarity" value={ordinal != null ? ordinalize(ordinal) : '—'} mark />
      </View>
    </View>
  );
}

function Cell({
  label,
  value,
  mark,
  borderRight,
  borderBottom,
}: {
  label: string;
  value: string;
  mark?: boolean;
  borderRight?: boolean;
  borderBottom?: boolean;
}) {
  return (
    <View
      style={[
        styles.cell,
        borderRight && styles.borderRight,
        borderBottom && styles.borderBottom,
      ]}
    >
      <Text style={styles.cellLabel}>{label.toUpperCase()}</Text>
      <Text style={[styles.cellValue, mark && styles.cellValueMark]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    backgroundColor: color.surface, // card stock — lighter than ground, so no shadow needed
    borderWidth: 1,
    borderColor: color.rule,
    borderRadius: layout.radiusStamp,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
  },
  cell: {
    flex: 1,
    paddingVertical: space.md, // tight inside the stamp block (DESIGN.md → Spacing)
    paddingHorizontal: space.md,
    gap: space.xs,
  },
  borderRight: {
    borderRightWidth: 1,
    borderRightColor: color.rule,
  },
  borderBottom: {
    borderBottomWidth: 1,
    borderBottomColor: color.rule,
  },
  cellLabel: {
    ...type.microLabel,
    color: color.inkMuted,
  },
  cellValue: {
    ...type.stampValue,
    color: color.ink,
    fontVariant: ['tabular-nums'],
  },
  cellValueMark: {
    color: color.mark, // red — rarity only
  },
});
