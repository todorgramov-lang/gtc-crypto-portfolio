import { formatTime } from '../lib/format';
import { useApp } from '../store';
import type { ConnectionStatus } from '../lib/types';

const DOT: Record<ConnectionStatus, { color: string; label: string }> = {
  live: { color: 'bg-profit', label: 'На живо' },
  degraded: { color: 'bg-warn', label: 'Забавени данни' },
  offline: { color: 'bg-loss', label: 'Няма връзка' },
};

/** Зелена / жълта / червена точка + час на последната актуализация. */
export default function ConnectionDot() {
  const { feed } = useApp();
  const dot = DOT[feed.status];

  return (
    <div className="flex items-center justify-center gap-2 text-[11px] text-fg-faint">
      <span className="relative flex h-2 w-2">
        {feed.status === 'live' && (
          <span
            className={`absolute inline-flex h-full w-full animate-ping rounded-full ${dot.color} opacity-60`}
          />
        )}
        <span className={`relative inline-flex h-2 w-2 rounded-full ${dot.color}`} />
      </span>

      <span>{dot.label}</span>

      {feed.fromCache && (
        <span className="rounded-full bg-warn/15 px-1.5 py-px font-medium text-warn">
          офлайн
        </span>
      )}

      {feed.lastUpdate !== null && (
        <>
          <span aria-hidden>·</span>
          <span className="num">{formatTime(new Date(feed.lastUpdate))}</span>
        </>
      )}
    </div>
  );
}
