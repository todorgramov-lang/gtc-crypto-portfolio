import { useEffect, useRef, useState } from 'react';
import type { Decimal } from '../lib/money';

interface Props {
  /** Числото, чиято промяна следим. */
  value: Decimal;
  /** Готовият за показване текст. */
  text: string;
  enabled: boolean;
  className?: string;
}

/**
 * Кратък зелен/червен flash при промяна на цената — 300 ms.
 * Следим самото число, а не текста, за да не мига при смяна на валута.
 */
export default function FlashValue({ value, text, enabled, className = '' }: Props) {
  const previous = useRef<Decimal | null>(null);
  const [flash, setFlash] = useState<'up' | 'down' | null>(null);

  useEffect(() => {
    const before = previous.current;
    previous.current = value;

    if (!enabled || before === null || value.eq(before)) return;

    setFlash(value.gt(before) ? 'up' : 'down');
    const timer = window.setTimeout(() => setFlash(null), 300);
    return () => window.clearTimeout(timer);
  }, [value, enabled]);

  const flashClass = flash === 'up' ? 'flash-up' : flash === 'down' ? 'flash-down' : '';

  return (
    <span className={`num rounded-sm px-1 ${flashClass} ${className}`}>{text}</span>
  );
}
