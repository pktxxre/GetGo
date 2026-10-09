import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { color, layout, space, type } from '../../theme/tokens';
import { REPORT_REASONS, reportPost, type ReportReason } from '../../lib/reports';

/**
 * The report sheet (W3 / Guideline 1.2). Reached from a muted "report this quest" link on quest
 * detail. Same full-bleed bone overlay as the AuthSheet — no toast, errors inline. Pick a reason,
 * optionally say more, send. On success it swaps to a plain acknowledgement: we don't promise a
 * specific outcome (moderation is out of band), just that it was received.
 *
 * A duplicate (you already flagged this post) is surfaced kindly rather than as a raw error — the
 * DB's one-per-reporter unique key is the guard, the client just reads the code.
 */
export function ReportSheet({
  postId,
  reporterId,
  onClose,
}: {
  postId: string;
  reporterId: string;
  onClose: () => void;
}) {
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const submit = async () => {
    if (!reason) return;
    setError(null);
    setBusy(true);
    try {
      await reportPost(postId, reporterId, reason, note);
      setDone(true);
    } catch (e) {
      const code = (e as { code?: string })?.code;
      setError(
        code === '23505'
          ? 'you’ve already reported this one — we’re on it.'
          : 'couldn’t send that — give it another go.',
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.overlay}>
      <ScrollView contentContainerStyle={styles.sheet} keyboardShouldPersistTaps="handled">
        <Pressable onPress={onClose} hitSlop={12} accessibilityRole="button" accessibilityLabel="close">
          <Text style={styles.close}>← BACK</Text>
        </Pressable>

        {done ? (
          <>
            <Text style={styles.title}>thanks — we’ll take a look</Text>
            <Text style={styles.body}>a person reviews every report. this one’s in the queue.</Text>
            <Pressable style={styles.button} onPress={onClose} accessibilityRole="button">
              <Text style={styles.buttonLabel}>done</Text>
            </Pressable>
          </>
        ) : (
          <>
            <Text style={styles.title}>report this quest</Text>
            <Text style={styles.body}>what’s wrong with it? a person will take a look.</Text>

            <View style={styles.reasons}>
              {REPORT_REASONS.map((r) => {
                const active = reason === r.value;
                return (
                  <Pressable
                    key={r.value}
                    onPress={() => setReason(r.value)}
                    style={[styles.reason, active && styles.reasonActive]}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: active }}
                    accessibilityLabel={r.label}
                  >
                    <Text style={[styles.reasonLabel, active && styles.reasonLabelActive]}>{r.label}</Text>
                  </Pressable>
                );
              })}
            </View>

            <TextInput
              style={styles.input}
              value={note}
              onChangeText={setNote}
              placeholder="anything else? (optional)"
              placeholderTextColor={color.inkMuted}
              multiline
              maxLength={500}
              accessibilityLabel="anything else"
            />

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <Pressable
              style={[styles.button, (!reason || busy) && styles.buttonDisabled]}
              disabled={!reason || busy}
              onPress={submit}
              accessibilityRole="button"
            >
              <Text style={styles.buttonLabel}>{busy ? 'sending…' : 'send report'}</Text>
            </Pressable>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: color.ground,
  },
  sheet: {
    flexGrow: 1,
    justifyContent: 'center',
    gap: space.lg,
    maxWidth: 340,
    width: '100%',
    alignSelf: 'center',
    paddingHorizontal: layout.pageMargin,
    paddingVertical: space.huge,
  },
  close: { ...type.dataLine, color: color.ink },
  title: { ...type.detailTitle, color: color.ink },
  body: { ...type.secondary, color: color.inkMuted },
  reasons: { gap: space.sm },
  reason: {
    borderWidth: 1,
    borderColor: color.rule,
    borderRadius: layout.radiusButton, // 4px — not a pill
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
  },
  reasonActive: {
    borderColor: color.ink,
    backgroundColor: color.surface,
  },
  reasonLabel: { ...type.body, color: color.inkMuted },
  reasonLabelActive: { color: color.ink },
  input: {
    ...type.body,
    color: color.ink,
    borderBottomWidth: 1,
    borderBottomColor: color.rule,
    paddingVertical: space.sm,
    minHeight: 44,
    textAlignVertical: 'top',
  },
  error: { ...type.secondary, color: color.error },
  button: {
    height: 56,
    borderRadius: layout.radiusButton,
    backgroundColor: color.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonDisabled: { opacity: 0.4 },
  buttonLabel: { ...type.buttonLabel, color: color.ground },
});
