import { useCallback, useEffect, useState } from 'react';
import { fetchUserPosts, type FeedItem } from '../lib/feed';

export type UserPostsStatus = 'loading' | 'ready' | 'error';

/**
 * Loads one user's completed quests for their profile grid. Same tiny shape as useFeed —
 * fetch once, manual retry on failure (the only place retry helps). Re-runs when the userId
 * changes, so navigating byline → byline swaps profiles cleanly.
 */
export function useUserPosts(userId: string | undefined) {
  const [items, setItems] = useState<FeedItem[]>([]);
  const [status, setStatus] = useState<UserPostsStatus>('loading');

  const load = useCallback(async () => {
    if (!userId) return;
    setStatus('loading');
    try {
      setItems(await fetchUserPosts(userId));
      setStatus('ready');
    } catch {
      setStatus('error');
    }
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    let live = true;
    setStatus('loading');
    fetchUserPosts(userId)
      .then((data) => {
        if (live) {
          setItems(data);
          setStatus('ready');
        }
      })
      .catch(() => live && setStatus('error'));
    return () => {
      live = false;
    };
  }, [userId]);

  return { items, status, reload: load };
}
