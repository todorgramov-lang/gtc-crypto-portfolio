import { ALL_PORTFOLIOS } from '../lib/portfolios';
import { useApp } from '../store';

/**
 * Превключвателят Общо · Анна · Тодор. Стои най-горе на началния екран и
 * определя какво виждат всички останали екрани.
 */
export default function PortfolioSwitcher() {
  const { portfolios, selection, setSelection } = useApp();

  // При едно-единствено портфолио превключвателят само заема място.
  if (portfolios.length < 2) return null;

  return (
    <div className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1">
      <button
        type="button"
        onClick={() => setSelection(ALL_PORTFOLIOS)}
        className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium transition ${
          selection === ALL_PORTFOLIOS
            ? 'bg-fg text-ink-900'
            : 'bg-ink-700 text-fg-muted'
        }`}
      >
        Общо
      </button>

      {portfolios.map((portfolio) => {
        const active = selection === portfolio.id;

        return (
          <button
            key={portfolio.id}
            type="button"
            onClick={() => setSelection(portfolio.id)}
            className={`flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium transition ${
              active ? 'text-ink-900' : 'bg-ink-700 text-fg-muted'
            }`}
            style={active ? { backgroundColor: portfolio.color } : undefined}
          >
            <span
              className="h-2 w-2 rounded-full"
              style={{
                backgroundColor: active ? 'rgb(0 0 0 / 0.35)' : portfolio.color,
              }}
            />
            {portfolio.name}
          </button>
        );
      })}
    </div>
  );
}
