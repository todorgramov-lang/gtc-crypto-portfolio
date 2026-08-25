import { NO_EXCHANGE, useApp } from '../store';

/**
 * Филтър по борса — Altcoins.bg, Binance, Тавекс и каквото друго си въвел.
 * Действа върху целия екран, не само върху списъка: наличности, средна цена
 * и печалба се преизчисляват само за избраната борса.
 */
export default function ExchangeSwitcher() {
  const { knownExchanges, exchangeFilter, setExchangeFilter, hasUnassignedExchange } =
    useApp();

  const optionCount = knownExchanges.length + (hasUnassignedExchange ? 1 : 0);

  // С една-единствена борса филтърът няма какво да избира.
  if (optionCount < 2) return null;

  const isActive = (value: string | null) =>
    value === null
      ? exchangeFilter === null
      : exchangeFilter?.toLowerCase() === value.toLowerCase();

  const chipClass = (active: boolean) =>
    `shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium transition ${
      active ? 'bg-ink-500 text-fg' : 'bg-ink-700/60 text-fg-muted'
    }`;

  return (
    <div className="no-scrollbar -mx-1 flex items-center gap-1.5 overflow-x-auto px-1">
      <span className="shrink-0 pr-0.5 text-sm text-fg-faint">Борса</span>

      <button
        type="button"
        onClick={() => setExchangeFilter(null)}
        className={chipClass(isActive(null))}
      >
        Всички
      </button>

      {knownExchanges.map((name) => (
        <button
          key={name}
          type="button"
          // Повторно натискане на активната изчиства филтъра.
          onClick={() => setExchangeFilter(isActive(name) ? null : name)}
          className={chipClass(isActive(name))}
        >
          {name}
        </button>
      ))}

      {hasUnassignedExchange && (
        <button
          type="button"
          onClick={() =>
            setExchangeFilter(exchangeFilter === NO_EXCHANGE ? null : NO_EXCHANGE)
          }
          className={chipClass(exchangeFilter === NO_EXCHANGE)}
        >
          Без борса
        </button>
      )}
    </div>
  );
}
