import { parseUserNumber, ZERO } from './money';
import { isAssetId, type AssetId } from './assets';
import { csvNumber, csvDate } from './format';
import { newId } from './storage';
import { makePortfolioId, nextColor, type Portfolio } from './portfolios';
import type { Transaction, TxType } from './types';

/**
 * Import / Export на транзакции.
 * Колони: date, asset, type, quantity, price, fee, exchange, note, portfolio
 *
 * Последната колона е добавена по-късно — файлове без нея се четат нормално
 * и редовете отиват в подразбиращото се портфолио.
 */

export const CSV_HEADER = 'date,asset,type,quantity,price,fee,exchange,note,portfolio';

function escapeField(field: string): string {
  if (!/[",\n]/.test(field)) return field;
  return `"${field.replace(/"/g, '""')}"`;
}

export function exportCsv(transactions: Transaction[], portfolios: Portfolio[] = []): string {
  const nameById = new Map(portfolios.map((p) => [p.id, p.name]));
  const rows = [...transactions]
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .map((tx) =>
      [
        csvDate(tx.date),
        tx.asset,
        tx.type,
        csvNumber(tx.quantity),
        csvNumber(tx.pricePerUnit),
        csvNumber(tx.fee),
        tx.exchange,
        tx.note ?? '',
        nameById.get(tx.portfolioId) ?? tx.portfolioId,
      ]
        .map(escapeField)
        .join(','),
    );

  return [CSV_HEADER, ...rows].join('\n') + '\n';
}

/** Разделя ред, като зачита кавичките. */
function splitLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let insideQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index]!;

    if (insideQuotes) {
      if (char === '"') {
        if (line[index + 1] === '"') {
          current += '"';
          index += 1;
        } else {
          insideQuotes = false;
        }
      } else {
        current += char;
      }
      continue;
    }

    if (char === '"') insideQuotes = true;
    else if (char === ',') {
      fields.push(current.trim());
      current = '';
    } else current += char;
  }

  fields.push(current.trim());
  return fields;
}

const TYPE_ALIASES: Record<string, TxType> = {
  buy: 'buy',
  покупка: 'buy',
  sell: 'sell',
  продажба: 'sell',
  transferin: 'transferIn',
  transfer_in: 'transferIn',
  in: 'transferIn',
  transferout: 'transferOut',
  transfer_out: 'transferOut',
  out: 'transferOut',
};

/** Приема ISO, както и няколко често срещани локални формата. */
function parseDate(raw: string): Date | null {
  const value = raw.trim();
  if (!value) return null;

  const iso = Date.parse(value);
  if (!Number.isNaN(iso)) return new Date(iso);

  // dd.MM.yyyy [HH:mm]
  const dotted = value.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})(?:\s+(\d{1,2}):(\d{2}))?$/);
  if (dotted) {
    const [, day, month, year, hour = '0', minute = '0'] = dotted;
    return new Date(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hour),
      Number(minute),
    );
  }

  return null;
}

export interface ImportResult {
  transactions: Transaction[];
  skippedLines: number[];
  /** Портфолиа, срещнати във файла, но липсващи в приложението. */
  newPortfolios: Portfolio[];
}

/**
 * Чете CSV. Последната колона е името на портфолиото — ако липсва (стари
 * файлове), редът отива в `fallbackPortfolioId`. Непознато име създава ново
 * портфолио, вместо да губи реда.
 */
export function parseCsv(
  text: string,
  portfolios: Portfolio[] = [],
  fallbackPortfolioId?: string,
): ImportResult {
  const transactions: Transaction[] = [];
  const skippedLines: number[] = [];

  const known: Portfolio[] = [...portfolios];
  const newPortfolios: Portfolio[] = [];
  const defaultId = fallbackPortfolioId ?? known[0]?.id ?? 'anna';

  function resolvePortfolio(raw: string): string {
    const name = raw.trim();
    if (name === '') return defaultId;

    const existing = known.find(
      (portfolio) =>
        portfolio.name.toLowerCase() === name.toLowerCase() || portfolio.id === name,
    );
    if (existing) return existing.id;

    const created: Portfolio = {
      id: makePortfolioId(name, known),
      name,
      color: nextColor(known),
    };
    known.push(created);
    newPortfolios.push(created);
    return created.id;
  }

  const lines = text.replace(/\r\n?/g, '\n').split('\n');

  lines.forEach((line, index) => {
    const trimmed = line.trim();
    if (!trimmed) return;

    const fields = splitLine(trimmed);
    if (fields.length < 6) {
      skippedLines.push(index + 1);
      return;
    }

    // Пропускаме заглавния ред.
    if (fields[0]!.toLowerCase() === 'date') return;

    const date = parseDate(fields[0]!);
    const assetRaw = fields[1]!.toUpperCase();
    const type = TYPE_ALIASES[fields[2]!.toLowerCase().replace(/\s/g, '')];
    const quantity = parseUserNumber(fields[3]!);
    const price = parseUserNumber(fields[4]!);

    if (!date || !isAssetId(assetRaw) || !type || !quantity || !price) {
      skippedLines.push(index + 1);
      return;
    }

    const note = fields[7] ?? '';

    transactions.push({
      id: newId(),
      asset: assetRaw as AssetId,
      type,
      quantity,
      pricePerUnit: price,
      fee: parseUserNumber(fields[5] ?? '') ?? ZERO,
      date,
      exchange: fields[6] ?? '',
      note: note === '' ? null : note,
      portfolioId: resolvePortfolio(fields[8] ?? ''),
    });
  });

  return { transactions, skippedLines, newPortfolios };
}

/**
 * Ключ за разпознаване на дубликати — повторен импорт на същия файл не бива
 * да удвоява данните.
 */
export function duplicateKey(tx: Transaction): string {
  return [
    // Портфолиото е част от ключа — една и съща сделка при Анна и при Тодор
    // са две различни неща, а не дубликат.
    tx.portfolioId,
    tx.asset,
    tx.type,
    csvNumber(tx.quantity),
    csvNumber(tx.pricePerUnit),
    Math.floor(tx.date.getTime() / 1000),
  ].join('|');
}

/** Сваля файл на устройството. */
export function downloadCsv(filename: string, contents: string): void {
  const blob = new Blob([contents], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
}
