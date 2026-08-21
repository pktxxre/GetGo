import { useEffect, useRef, useState } from 'react';

/**
 * Anti-flicker gate for loading states. Two thresholds (SHELL_SPEC → Placeholder):
 *   - don't show placeholders for loads that finish under 150ms — a flash reads as jank
 *   - once shown, hold at least 300ms so a fast-but-not-instant load doesn't blink
 *
 * Returns whether the loading UI should currently render.
 */
export function useDelayedLoading(
  isLoading: boolean,
  { delayMs = 150, minVisibleMs = 300 }: { delayMs?: number; minVisibleMs?: number } = {},
): boolean {
  const [visible, setVisible] = useState(false);
  const shownAt = useRef<number | null>(null);

  useEffect(() => {
    let showTimer: ReturnType<typeof setTimeout> | undefined;
    let hideTimer: ReturnType<typeof setTimeout> | undefined;

    if (isLoading) {
      // Wait out the delay before committing to showing anything.
      showTimer = setTimeout(() => {
        shownAt.current = Date.now();
        setVisible(true);
      }, delayMs);
    } else if (visible && shownAt.current != null) {
      // Already visible — keep it up until the minimum has elapsed.
      const elapsed = Date.now() - shownAt.current;
      const remaining = Math.max(0, minVisibleMs - elapsed);
      hideTimer = setTimeout(() => {
        shownAt.current = null;
        setVisible(false);
      }, remaining);
    } else {
      // Load finished before we ever showed the placeholder — never show it.
      setVisible(false);
    }

    return () => {
      if (showTimer) clearTimeout(showTimer);
      if (hideTimer) clearTimeout(hideTimer);
    };
  }, [isLoading, visible, delayMs, minVisibleMs]);

  return visible;
}
