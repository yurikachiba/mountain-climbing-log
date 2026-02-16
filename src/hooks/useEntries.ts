import { useState, useEffect, useCallback } from 'react';
import type { DiaryEntry } from '../types';
import { getAllEntries, getEntryCount } from '../db';

export function useEntries() {
  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const all = await getAllEntries();
    setEntries(all);
    const c = await getEntryCount();
    setCount(c);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { entries, count, loading, refresh };
}
