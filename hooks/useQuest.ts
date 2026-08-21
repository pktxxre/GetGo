import { useCallback, useEffect, useState } from 'react';
import { fetchQuest, type QuestDetail } from '../lib/quest';

export type QuestStatus = 'loading' | 'ready' | 'notFound' | 'error';

/**
 * Loads one quest. `notFound` and `error` are kept distinct on purpose (DESIGN.md → three
 * failures, three verbs): a missing/invisible post can't be retried into existence, a network
 * flake can — so only `error` offers retry.
 */
export function useQuest(id: string | undefined) {
  const [quest, setQuest] = useState<QuestDetail | null>(null);
  const [status, setStatus] = useState<QuestStatus>('loading');

  const load = useCallback(async () => {
    if (!id) {
      setStatus('notFound');
      return;
    }
    setStatus('loading');
    try {
      const data = await fetchQuest(id);
      if (data) {
        setQuest(data);
        setStatus('ready');
      } else {
        setStatus('notFound');
      }
    } catch {
      setStatus('error');
    }
  }, [id]);

  useEffect(() => {
    let live = true;
    (async () => {
      if (!id) {
        setStatus('notFound');
        return;
      }
      setStatus('loading');
      try {
        const data = await fetchQuest(id);
        if (!live) return;
        if (data) {
          setQuest(data);
          setStatus('ready');
        } else {
          setStatus('notFound');
        }
      } catch {
        if (live) setStatus('error');
      }
    })();
    return () => {
      live = false;
    };
  }, [id]);

  return { quest, status, reload: load };
}
