import { useState, useEffect, useCallback } from 'react';
import type { AiCache } from '../types';
import { getAllAiCache, putAiCache, addAiLog } from '../db';

export function useAiCache() {
  const [cache, setCache] = useState<Record<string, AiCache>>({});
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const all = await getAllAiCache();
    const map: Record<string, AiCache> = {};
    for (const c of all) {
      map[c.type] = c;
    }
    setCache(map);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // 分析結果をキャッシュに保存し、ログにも蓄積する
  const save = useCallback(async (type: string, result: string, entryCount: number) => {
    const now = new Date().toISOString();

    const cacheEntry: AiCache = {
      type,
      result,
      analyzedAt: now,
      entryCount,
      isStale: false,
    };
    await putAiCache(cacheEntry);

    // ログとして蓄積（消さない）
    await addAiLog({
      id: crypto.randomUUID(),
      type,
      result,
      analyzedAt: now,
      entryCount,
    });

    setCache(prev => ({ ...prev, [type]: cacheEntry }));
  }, []);

  return { cache, loading, reload: load, save };
}
