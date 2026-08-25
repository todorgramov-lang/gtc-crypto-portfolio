import { describe, expect, it } from 'vitest';

import { availableQuantity, computeHolding, computeSummary } from './calc';
import { dec } from './money';
import { exportCsv, parseCsv } from './csv';
import type { AssetId } from './assets';
import type { Quote, Quotes, Transaction, TxType } from './types';

/** Тестове точно върху формулите от заданието. */

let counter = 0;

function tx(
  type: TxType,
  quantity: string,
  price: string,
  options: { fee?: string; day?: number; asset?: AssetId } = {},
): Transaction {
  counter += 1;
  return {
    id: `tx-${counter}`,
    asset: options.asset ?? 'BTC',
    type,
    quantity: dec(quantity),
    pricePerUnit: dec(price),
    fee: dec(options.fee ?? '0'),
    date: new Date(2025, 0, options.day ?? 1),
    exchange: 'Binance',
    note: null,
  };
}

function quote(price: string, change = '0', asset: AssetId = 'BTC'): Quote {
  return {
    asset,
    price: dec(price),
    change24hPercent: dec(change),
    source: 'cache',
    timestamp: Date.now(),
  };
}

describe('наличност', () => {
  it('събира входящите и вади изходящите движения', () => {
    const transactions = [
      tx('buy', '1', '20000', { day: 1 }),
      tx('transferIn', '0.5', '0', { day: 2 }),
      tx('sell', '0.25', '30000', { day: 3 }),
      tx('transferOut', '0.25', '0', { day: 4 }),
    ];

    const holding = computeHolding('BTC', transactions, quote('40000'), 'average');
    expect(holding.quantity.toString()).toBe('1');
  });
});

describe('средна цена', () => {
  it('включва таксите при покупка', () => {
    const transactions = [
      tx('buy', '1', '20000', { fee: '100', day: 1 }),
      tx('buy', '1', '30000', { fee: '200', day: 2 }),
    ];

    const holding = computeHolding('BTC', transactions, quote('40000'), 'average');

    // (1×20000 + 100 + 1×30000 + 200) / 2 = 25150
    expect(holding.averageCost.toString()).toBe('25150');
    expect(holding.invested.toString()).toBe('50300');
    expect(holding.currentValue.toString()).toBe('80000');
    expect(holding.unrealizedProfitLoss.toString()).toBe('29700');
  });

  it('смята нереализирана П/З в проценти', () => {
    const holding = computeHolding(
      'BTC',
      [tx('buy', '2', '100', { day: 1 })],
      quote('150'),
      'average',
    );

    expect(holding.invested.toString()).toBe('200');
    expect(holding.unrealizedProfitLoss.toString()).toBe('100');
    expect(holding.unrealizedProfitLossPercent.toString()).toBe('50');
  });
});

describe('реализирана П/З', () => {
  const transactions = () => [
    tx('buy', '1', '10000', { day: 1 }),
    tx('buy', '1', '20000', { day: 2 }),
    tx('sell', '1', '25000', { fee: '50', day: 3 }),
  ];

  it('по метода на средната цена', () => {
    const holding = computeHolding('BTC', transactions(), quote('30000'), 'average');

    // Средна към момента на продажбата = 15 000 → 1 × (25000 − 15000) − 50
    expect(holding.realizedProfitLoss.toString()).toBe('9950');
    expect(holding.quantity.toString()).toBe('1');
  });

  it('по метода FIFO', () => {
    const holding = computeHolding('BTC', transactions(), quote('30000'), 'fifo');

    // FIFO продава първата партида на 10 000 → 25000 − 10000 − 50
    expect(holding.realizedProfitLoss.toString()).toBe('14950');
    expect(holding.quantity.toString()).toBe('1');
    expect(holding.averageCost.toString()).toBe('20000');
    expect(holding.invested.toString()).toBe('20000');
  });

  it('FIFO консумира частично партида', () => {
    const transactions = [
      tx('buy', '2', '100', { day: 1 }),
      tx('buy', '2', '200', { day: 2 }),
      tx('sell', '3', '300', { day: 3 }),
    ];

    const holding = computeHolding('BTC', transactions, quote('300'), 'fifo');

    // 2 × (300 − 100) + 1 × (300 − 200) = 500
    expect(holding.realizedProfitLoss.toString()).toBe('500');
    expect(holding.quantity.toString()).toBe('1');
    expect(holding.averageCost.toString()).toBe('200');
  });
});

describe('24-часова промяна', () => {
  it('извежда цената отпреди 24ч от процента', () => {
    const holding = computeHolding(
      'BTC',
      [tx('buy', '1', '100', { day: 1 })],
      quote('110', '10'),
      'average',
    );

    // 110 / 1.1 = 100
    expect(holding.value24hAgo.toString()).toBe('100');
    expect(holding.change24hValue.toString()).toBe('10');
  });
});

describe('портфолио', () => {
  it('смята общите суми и дяловете', () => {
    const transactions = [
      tx('buy', '1', '100', { day: 1, asset: 'BTC' }),
      tx('buy', '10', '10', { day: 1, asset: 'ETH' }),
    ];

    const quotes: Quotes = {
      BTC: quote('300', '0', 'BTC'),
      ETH: quote('30', '0', 'ETH'),
    };

    const summary = computeSummary(transactions, quotes, 'average');

    expect(summary.totalInvested.toString()).toBe('200');
    expect(summary.totalValue.toString()).toBe('600');
    expect(summary.totalProfitLoss.toString()).toBe('400');
    expect(summary.totalProfitLossPercent.toString()).toBe('200');
    expect(summary.allocation.BTC.toString()).toBe('50');
    expect(summary.allocation.ETH.toString()).toBe('50');
  });
});

describe('валидация на продажби', () => {
  it('изключва редактираната транзакция от наличността', () => {
    const sell = tx('sell', '0.5', '200', { day: 3 });
    const transactions = [tx('buy', '1', '100', { day: 1 }), sell];

    expect(availableQuantity('BTC', transactions).toString()).toBe('0.5');
    expect(availableQuantity('BTC', transactions, sell.id).toString()).toBe('1');
  });
});

describe('празен актив', () => {
  it('връща нули без да се чупи', () => {
    const holding = computeHolding('SOL', [], quote('150', '0', 'SOL'), 'average');

    expect(holding.quantity.toString()).toBe('0');
    expect(holding.invested.toString()).toBe('0');
    expect(holding.unrealizedProfitLossPercent.toString()).toBe('0');
    expect(holding.hasActivity).toBe(false);
  });
});

describe('точност', () => {
  it('не допуска грешките на плаващата запетая', () => {
    // Класическият случай: 0.1 + 0.2 !== 0.3 при обикновени числа.
    const transactions = [
      tx('buy', '0.1', '1', { day: 1 }),
      tx('buy', '0.2', '1', { day: 2 }),
    ];

    const holding = computeHolding('BTC', transactions, quote('1'), 'average');
    expect(holding.quantity.toString()).toBe('0.3');
    expect(holding.invested.toString()).toBe('0.3');
  });
});

describe('CSV', () => {
  it('преживява експорт и импорт без загуба', () => {
    const original = [
      tx('buy', '0.5', '42000.25', { fee: '3.5', day: 1 }),
      tx('sell', '0.25', '51000', { fee: '2', day: 5, asset: 'ETH' }),
    ];

    const parsed = parseCsv(exportCsv(original));

    expect(parsed.skippedLines).toHaveLength(0);
    expect(parsed.transactions).toHaveLength(2);
    expect(parsed.transactions[0]!.quantity.toString()).toBe('0.5');
    expect(parsed.transactions[0]!.pricePerUnit.toString()).toBe('42000.25');
    expect(parsed.transactions[1]!.asset).toBe('ETH');
    expect(parsed.transactions[1]!.type).toBe('sell');
  });
});
