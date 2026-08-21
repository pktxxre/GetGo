import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { color, layout, space, type } from '../../theme/tokens';
import { useSession } from '../../lib/auth';

/**
 * The one auth surface. A signed-out visitor taps `save it` and lands here: email → a 6-digit
 * code → in. No password, no social buttons on the funnel (DESIGN.md voice; see lib/auth). It
 * captures the identity a save needs at the exact moment intent is highest.
 *
 * Errors surface inline under the field — never a toast, never a modal alert (DESIGN.md →
 * Action failures). `onAuthed` fires after a verified code; the session itself arrives via the
 * provider's auth listener.
 */
export function AuthSheet({ onClose, onAuthed }: { onClose: () => void; onAuthed: () => void }) {
  const { sendCode, verifyCode } = useSession();
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState('');
  const [codeText, setCodeText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = async () => {
    setError(null);
    setBusy(true);
    try {
      await sendCode(email);
      setStep('code');
    } catch {
      setError('that email didn’t work. check it and try again.');
    } finally {
      setBusy(false);
    }
  };

  const verify = async () => {
    setError(null);
    setBusy(true);
    try {
      await verifyCode(email, codeText);
      onAuthed();
    } catch {
      setError('that code didn’t match. check it, or send a new one.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.overlay}>
      <View style={styles.sheet}>
        <Pressable onPress={onClose} hitSlop={12} accessibilityRole="button" accessibilityLabel="close">
          <Text style={styles.close}>← BACK</Text>
        </Pressable>

        <Text style={styles.title}>save it to your log</Text>

        {step === 'email' ? (
          <>
            <Text style={styles.body}>we’ll email you a code. no password.</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="you@email.com"
              placeholderTextColor={color.inkMuted}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              inputMode="email"
              autoFocus
              accessibilityLabel="your email"
            />
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <Pressable
              style={[styles.button, (!email || busy) && styles.buttonDisabled]}
              disabled={!email || busy}
              onPress={send}
              accessibilityRole="button"
            >
              <Text style={styles.buttonLabel}>{busy ? 'sending…' : 'send me a code'}</Text>
            </Pressable>
          </>
        ) : (
          <>
            <Text style={styles.body}>we sent a code to {email}.</Text>
            <TextInput
              style={styles.input}
              value={codeText}
              onChangeText={setCodeText}
              placeholder="6-digit code"
              placeholderTextColor={color.inkMuted}
              keyboardType="number-pad"
              inputMode="numeric"
              maxLength={6}
              autoFocus
              accessibilityLabel="6-digit code"
            />
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <Pressable
              style={[styles.button, (codeText.length < 6 || busy) && styles.buttonDisabled]}
              disabled={codeText.length < 6 || busy}
              onPress={verify}
              accessibilityRole="button"
            >
              <Text style={styles.buttonLabel}>{busy ? 'checking…' : 'let me in'}</Text>
            </Pressable>
            <Pressable onPress={() => { setStep('email'); setCodeText(''); setError(null); }} hitSlop={8}>
              <Text style={styles.secondary}>use a different email</Text>
            </Pressable>
          </>
        )}
      </View>
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
    justifyContent: 'center',
    paddingHorizontal: layout.pageMargin,
  },
  sheet: {
    gap: space.lg,
    maxWidth: 340,
    width: '100%',
    alignSelf: 'center',
  },
  close: {
    ...type.dataLine,
    color: color.ink,
  },
  title: {
    ...type.detailTitle,
    color: color.ink,
  },
  body: {
    ...type.secondary,
    color: color.inkMuted,
  },
  input: {
    ...type.body,
    color: color.ink,
    borderBottomWidth: 1,
    borderBottomColor: color.rule,
    paddingVertical: space.sm,
  },
  error: {
    ...type.secondary,
    color: color.error,
  },
  button: {
    height: 56,
    borderRadius: layout.radiusButton,
    backgroundColor: color.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonDisabled: {
    opacity: 0.4,
  },
  buttonLabel: {
    ...type.buttonLabel,
    color: color.ground,
  },
  secondary: {
    ...type.dataLine,
    color: color.inkMuted,
    textDecorationLine: 'underline',
    alignSelf: 'flex-start',
  },
});
