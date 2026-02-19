import { useState, useEffect, useCallback } from 'react';
import type { Observation } from '../types';
import { getAllObservations, getObservationCount } from '../db';

export function useObservations() {
  const [observations, setObservations] = useState<Observation[]>([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const all = await getAllObservations();
    setObservations(all);
    const c = await getObservationCount();
    setCount(c);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { observations, count, loading, refresh };
}
