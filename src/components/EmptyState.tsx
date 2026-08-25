interface Props {
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}

export default function EmptyState({ title, message, actionLabel, onAction }: Props) {
  return (
    <div className="rounded-2xl border border-dashed border-ink-600 px-6 py-10 text-center">
      <p className="text-base font-semibold">{title}</p>
      <p className="mx-auto mt-2 max-w-[34ch] text-sm leading-relaxed text-fg-muted">
        {message}
      </p>

      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="mt-4 rounded-full bg-fg px-4 py-2 text-sm font-semibold text-ink-900 transition active:scale-95"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}
