import { useCallback, useEffect, useState } from 'react';
import { fetchFeed, type FeedItem } from '../lib/feed';

export type FeedStatus = 'loading' | 'ready' | 'error';

/**
 * Loads the front-door feed. Deliberately tiny — no cache, no pagination yet; the front
 * door fetches once and offers a manual retry on failure (the only place retry helps —
 * SHELL_SPEC → invariant 2). `reload` re-runs the query for the `failed` state's retry.
 *
 * `refresh` is the quiet variant: it re-fetches without flipping back to `loading`, so
 * returning to the feed after posting shows the new post with no placeholder flash.
 */
export function useFeed() {
  const [items, setItems] = useState<FeedItem[]>([]);
  const [status, setStatus] = useState<FeedStatus>('loading');

  const load = useCallback(async () => {
    setStatus('loading');
    try {
      const data = await fetchFeed();
      setItems(data);
      setStatus('ready');
    } catch {
      setStatus('error');
    }
  }, []);

  const refresh = useCallback(async () => {
    try {
      const data = await fetchFeed();
      setItems(data);
      setStatus('ready');
    } catch {
      // keep whatever's on screen — a background refresh must not blank the feed.
    }
  }, []);

  useEffect(() => {
    let live = true;
    (async () => {
      setStatus('loading');
      try {
        const data = await fetchFeed();
        if (live) {
          setItems(data);
          setStatus('ready');
        }
      } catch {
        if (live) setStatus('error');
      }
    })();
    return () => {
      live = false;
    };
  }, []);

  return { items, status, reload: load, refresh };
}
