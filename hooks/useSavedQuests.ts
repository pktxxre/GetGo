import { useCallback, useEffect, useState } from 'react';
import { fetchSavedQuests, type FeedItem } from '../lib/feed';

export type SavedStatus = 'idle' | 'loading' | 'ready' | 'error';

/**
 * Your saved quest log for the `/you` "saved" tab. Fetches lazily — nothing loads until the
 * saved tab is actually selected (`enabled`), mirroring useNearby — so opening your profile to
 * see your quests never pays for a second query you didn't ask for. Re-runs if the user id
 * changes (e.g. sign out → sign in as someone else).
 */
export function useSavedQuests(userId: string | undefined, enabled: boolean) {
  const [items, setItems] = useState<FeedItem[]>([]);
  const [status, setStatus] = useState<SavedStatus>('idle');

  const load = useCallback(async () => {
    if (!userId) return;
    setStatus('loading');
    try {
      setItems(await fetchSavedQuests(userId));
      setStatus('ready');
    } catch {
      setStatus('error');
    }
  }, [userId]);

  useEffect(() => {
    if (enabled && status === 'idle') load();
  }, [enabled, status, load]);

  return { items, status, reload: load };
}
