import { useEffect, useRef, useState } from 'react';

/**
 * Дърпане надолу за опресняване. Работи само когато списъкът е най-горе,
 * за да не се бие с нормалното скролване.
 */
export function usePullToRefresh(onRefresh: () => Promise<void>) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const startY = useRef<number | null>(null);
  const THRESHOLD = 70;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleTouchStart = (event: TouchEvent) => {
      if (container.scrollTop > 0 || refreshing) return;
      startY.current = event.touches[0]?.clientY ?? null;
    };

    const handleTouchMove = (event: TouchEvent) => {
      if (startY.current === null) return;

      const currentY = event.touches[0]?.clientY ?? 0;
      const distance = currentY - startY.current;

      if (distance <= 0) {
        setPull(0);
        return;
      }

      // Съпротивление — не следваме пръста едно към едно.
      setPull(Math.min(distance * 0.45, THRESHOLD * 1.4));
    };

    const handleTouchEnd = () => {
      const shouldRefresh = pull >= THRESHOLD;
      startY.current = null;
      setPull(0);

      if (!shouldRefresh || refreshing) return;

      setRefreshing(true);
      void onRefresh().finally(() => setRefreshing(false));
    };

    container.addEventListener('touchstart', handleTouchStart, { passive: true });
    container.addEventListener('touchmove', handleTouchMove, { passive: true });
    container.addEventListener('touchend', handleTouchEnd);

    return () => {
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('touchend', handleTouchEnd);
    };
  }, [pull, refreshing, onRefresh]);

  return { containerRef, pull, refreshing, threshold: THRESHOLD };
}
