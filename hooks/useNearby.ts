import { useCallback, useEffect, useState } from 'react';
import { fetchNearby, type FeedItem } from '../lib/feed';
import { getCoords } from '../lib/location';

/** `needsLocation` is its own state, not an error — permission denial is a choice, and the fix
 *  (grant + retry) is different from a failed fetch. */
export type NearbyStatus = 'idle' | 'loading' | 'ready' | 'error' | 'needsLocation';

/**
 * The "nearby" tab's data. Layered alongside the time feed (useFeed) rather than replacing it,
 * so the front door's default path keeps its focus-refresh untouched. Fetches lazily: nothing
 * happens — and no location prompt fires — until the user actually selects nearby (`enabled`).
 */
export function useNearby(enabled: boolean) {
  const [items, setItems] = useState<FeedItem[]>([]);
  const [status, setStatus] = useState<NearbyStatus>('idle');

  const load = useCallback(async () => {
    setStatus('loading');
    try {
      const coords = await getCoords();
      if (!coords) {
        setStatus('needsLocation'); // denied → prompt to enable, not an error
        return;
      }
      setItems(await fetchNearby(coords));
      setStatus('ready');
    } catch {
      setStatus('error');
    }
  }, []);

  // Fetch once when the tab first becomes active (idle → load). Selecting another tab and
  // returning keeps the result; the retry action re-runs on demand.
  useEffect(() => {
    if (enabled && status === 'idle') load();
  }, [enabled, status, load]);

  return { items, status, reload: load };
}
