import { describe, expect, it } from 'vitest';

import { availableQuantity, computeHolding, computeSummary } from './calc';
import { dec } from './money';
import { exportCsv, parseCsv } from './csv';
import { convertTransaction } from './convert';
import {
  GRAMS_PER_TROY_OUNCE,
  toCanonicalPrice,
  toCanonicalQuantity,
  toDisplayPrice,
  toDisplayQuantity,
} from './units';
import type { AssetId } from './assets';
import type { Quote, Quotes, Transaction, TxType } from './types';

/** Тестове точно върху формулите от заданието. */

let counter = 0;

function tx(
  type: TxType,
  quantity: string,
  price: string,
  options: {
    fee?: string;
    day?: number;
    asset?: AssetId;
    portfolioId?: string;
    currency?: 'EUR' | 'USD';
  } = {},
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
    portfolioId: options.portfolioId ?? 'anna',
    currency: options.currency ?? 'USD',
  };
}

/** Както приложението — филтрира по избраното портфолио. */
function inPortfolio(transactions: Transaction[], portfolioId: string): Transaction[] {
  return transactions.filter((item) => item.portfolioId === portfolioId);
}

/**
 * Сравнява на 10 знака.
 *
 * Формулата от заданието е „Инвестирано = Наличност × Средна цена", а
 * средната цена е частно. Когато то е безкрайна десетична дроб — например
 * 500 / 3 — обратното умножение оставя остатък около трийсетия знак.
 * Това не е грешка в сметките, а свойство на самото деление; в приложението
 * никога не се вижда, защото сумите се показват с 2 знака. Десет знака са
 * достатъчно строги, за да хванат истинска грешка, и достатъчно свободни, за
 * да не се спъват в 1e-31.
 */
function near(value: { toFixed: (n: number) => string }, expected: string): void {
  expect(value.toFixed(10)).toBe(dec(expected).toFixed(10));
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

    expect(summary.crypto.invested.toString()).toBe('200');
    expect(summary.crypto.value.toString()).toBe('600');
    expect(summary.crypto.profitLoss.toString()).toBe('400');
    expect(summary.crypto.profitLossPercent.toString()).toBe('200');
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

describe('портфолиа', () => {
  // Анна: 1 BTC по 100. Тодор: 2 BTC по 200.
  const transactions = [
    tx('buy', '1', '100', { day: 1, portfolioId: 'anna' }),
    tx('buy', '2', '200', { day: 2, portfolioId: 'todor' }),
  ];
  const quotes: Quotes = { BTC: quote('300') };

  it('всяко портфолио се смята само със своите транзакции', () => {
    const anna = computeSummary(inPortfolio(transactions, 'anna'), quotes, 'average');
    const todor = computeSummary(inPortfolio(transactions, 'todor'), quotes, 'average');

    expect(anna.crypto.invested.toString()).toBe('100');
    expect(anna.crypto.value.toString()).toBe('300');
    expect(anna.crypto.profitLoss.toString()).toBe('200');

    expect(todor.crypto.invested.toString()).toBe('400');
    expect(todor.crypto.value.toString()).toBe('600');
    expect(todor.crypto.profitLoss.toString()).toBe('200');
  });

  it('общият изглед сумира двете и не смесва средните цени', () => {
    const total = computeSummary(transactions, quotes, 'average');

    // 3 BTC общо, себестойност (100 + 400) / 3
    near(total.crypto.invested, '500');
    near(total.crypto.value, '900');
    near(total.crypto.profitLoss, '400');

    const anna = computeSummary(inPortfolio(transactions, 'anna'), quotes, 'average');
    const todor = computeSummary(inPortfolio(transactions, 'todor'), quotes, 'average');

    // Общото съвпада със сбора на двете.
    near(total.crypto.value, anna.crypto.value.plus(todor.crypto.value).toFixed());
    near(total.crypto.profitLoss, anna.crypto.profitLoss.plus(todor.crypto.profitLoss).toFixed());
    near(total.crypto.invested, anna.crypto.invested.plus(todor.crypto.invested).toFixed());
  });

  it('наличността на едното не покрива продажба от другото', () => {
    // Тодор има 2 BTC; Анна има 1.
    expect(
      availableQuantity('BTC', inPortfolio(transactions, 'anna')).toString(),
    ).toBe('1');
    expect(
      availableQuantity('BTC', inPortfolio(transactions, 'todor')).toString(),
    ).toBe('2');
  });
});

describe('злато и мерки', () => {
  it('грамовете се превръщат в унции и обратно без загуба', () => {
    // 100 грама кюлче.
    const canonical = toCanonicalQuantity(dec('100'), 'XAU', 'g');
    expect(toDisplayQuantity(canonical, 'XAU', 'g').toFixed(10)).toBe(
      dec('100').toFixed(10),
    );

    // 100 г = 100 / 31.1034768 тройунции
    const expectedOunces = dec('100').div(dec(GRAMS_PER_TROY_OUNCE));
    expect(canonical.toFixed(12)).toBe(expectedOunces.toFixed(12));
  });

  it('цената за грам е цената за унция, делена на 31.1034768', () => {
    const perOunce = dec('4629.22');
    const perGram = toDisplayPrice(perOunce, 'XAU', 'g');

    expect(perGram.toFixed(4)).toBe(perOunce.div(dec(GRAMS_PER_TROY_OUNCE)).toFixed(4));
    // Обратно към каноничната.
    expect(toCanonicalPrice(perGram, 'XAU', 'g').toFixed(6)).toBe(perOunce.toFixed(6));
  });

  it('криптовалутите не се пипат от мярката', () => {
    const value = dec('0.05');
    expect(toCanonicalQuantity(value, 'BTC', 'g').toString()).toBe('0.05');
    expect(toDisplayQuantity(value, 'BTC', 'g').toString()).toBe('0.05');
    expect(toDisplayPrice(dec('42000'), 'BTC', 'g').toString()).toBe('42000');
  });

  it('стойността излиза еднаква, независимо в какво си въвел', () => {
    // Едно и също: 100 г по 148.83 долара, или 3.2151 унции по 4629.22.
    const perOunce = dec('4629.22');
    const perGram = toDisplayPrice(perOunce, 'XAU', 'g');

    const viaGrams = {
      quantity: toCanonicalQuantity(dec('100'), 'XAU', 'g'),
      price: toCanonicalPrice(perGram, 'XAU', 'g'),
    };
    const viaOunces = {
      quantity: toCanonicalQuantity(dec('100').div(dec(GRAMS_PER_TROY_OUNCE)), 'XAU', 'oz'),
      price: toCanonicalPrice(perOunce, 'XAU', 'oz'),
    };

    near(
      viaGrams.quantity.times(viaGrams.price),
      viaOunces.quantity.times(viaOunces.price).toFixed(),
    );
  });

  it('златото се смята наравно с останалите активи', () => {
    // 1 унция по 4000, сега 4629.22
    const transactions = [tx('buy', '1', '4000', { day: 1, asset: 'XAU' })];
    const holding = computeHolding(
      'XAU',
      transactions,
      quote('4629.22', '0', 'XAU'),
      'average',
    );

    expect(holding.quantity.toString()).toBe('1');
    expect(holding.invested.toString()).toBe('4000');
    expect(holding.currentValue.toString()).toBe('4629.22');
    expect(holding.unrealizedProfitLoss.toString()).toBe('629.22');
  });
});

describe('златото стои отделно', () => {
  const transactions = [
    tx('buy', '1', '100', { day: 1, asset: 'BTC' }),
    tx('buy', '1', '4000', { day: 2, asset: 'XAU' }),
  ];
  const quotes: Quotes = {
    BTC: quote('300', '0', 'BTC'),
    XAU: quote('4600', '0', 'XAU'),
  };

  it('не влиза в общата стойност на криптото', () => {
    const summary = computeSummary(transactions, quotes, 'average');

    // Криптото вижда само биткойна.
    expect(summary.crypto.value.toString()).toBe('300');
    expect(summary.crypto.invested.toString()).toBe('100');
    expect(summary.crypto.profitLoss.toString()).toBe('200');

    // Златото си има собствени суми.
    expect(summary.metal.value.toString()).toBe('4600');
    expect(summary.metal.invested.toString()).toBe('4000');
    expect(summary.metal.profitLoss.toString()).toBe('600');
  });

  it('двете заедно дават общото', () => {
    const summary = computeSummary(transactions, quotes, 'average');

    near(summary.combined.value, summary.crypto.value.plus(summary.metal.value).toFixed());
    near(
      summary.combined.profitLoss,
      summary.crypto.profitLoss.plus(summary.metal.profitLoss).toFixed(),
    );
  });

  it('дяловете се смятат само в рамките на криптото', () => {
    const withEth = [...transactions, tx('buy', '10', '10', { day: 3, asset: 'ETH' })];
    const summary = computeSummary(
      withEth,
      { ...quotes, ETH: quote('30', '0', 'ETH') },
      'average',
    );

    // BTC 300 + ETH 300 = 600 крипто; златото не участва в кръга.
    expect(summary.allocation.BTC.toString()).toBe('50');
    expect(summary.allocation.ETH.toString()).toBe('50');
    expect(summary.allocation.XAU.toString()).toBe('0');
  });
});

describe('валута на сделката', () => {
  /** Както приложението: сделките се привеждат към показваната валута. */
  const inCurrency = (
    transactions: Transaction[],
    to: 'EUR' | 'USD',
    eurPerUsd: string,
  ) => transactions.map((tx) => convertTransaction(tx, to, dec(eurPerUsd)));

  it('еврова покупка остава непокътната, колкото и да мърда курсът', () => {
    // 2 унции по €3 500 — платил си точно €7 000.
    const bought = [tx('buy', '2', '3500', { day: 1, asset: 'XAU', currency: 'EUR' })];

    for (const rate of ['0.80', '0.856', '0.95']) {
      const holding = computeHolding(
        'XAU',
        inCurrency(bought, 'EUR', rate),
        quote('4000', '0', 'XAU'),
        'average',
      );

      // Инвестираното е €7 000 при всеки курс — това е смисълът на промяната.
      expect(holding.invested.toString()).toBe('7000');
      expect(holding.averageCost.toString()).toBe('3500');
    }
  });

  it('доларова покупка се превръща по курса, когато гледаш в евро', () => {
    const bought = [tx('buy', '1', '1000', { day: 1, currency: 'USD' })];

    const holding = computeHolding(
      'BTC',
      inCurrency(bought, 'EUR', '0.85'),
      quote('850', '0', 'BTC'),
      'average',
    );

    // 1000 долара × 0.85 = 850 евро
    expect(holding.invested.toString()).toBe('850');
    expect(holding.unrealizedProfitLoss.toString()).toBe('0');
  });

  it('смесени валути се сумират в показваната', () => {
    const mixed = [
      tx('buy', '1', '1000', { day: 1, asset: 'BTC', currency: 'USD' }),
      tx('buy', '1', '1000', { day: 2, asset: 'ETH', currency: 'EUR' }),
    ];

    const summary = computeSummary(
      inCurrency(mixed, 'EUR', '0.85'),
      { BTC: quote('0', '0', 'BTC'), ETH: quote('0', '0', 'ETH') },
      'average',
    );

    // 1000 USD → 850 EUR, плюс 1000 EUR както си е.
    expect(summary.crypto.invested.toString()).toBe('1850');
  });

  it('преминаването през долари и обратно връща същото число', () => {
    const original = tx('buy', '1', '3500', { day: 1, asset: 'XAU', currency: 'EUR' });
    const rate = dec('0.856');

    const toUsd = convertTransaction(original, 'USD', rate);
    const backToEur = convertTransaction(toUsd, 'EUR', rate);

    near(backToEur.pricePerUnit, '3500');
  });
});

describe('CSV', () => {
  const PORTFOLIOS = [
    { id: 'anna', name: 'Анна', color: '#E879A6' },
    { id: 'todor', name: 'Тодор', color: '#5B9DFF' },
  ];

  it('преживява експорт и импорт без загуба', () => {
    const original = [
      tx('buy', '0.5', '42000.25', { fee: '3.5', day: 1 }),
      tx('sell', '0.25', '51000', { fee: '2', day: 5, asset: 'ETH' }),
    ];

    const parsed = parseCsv(exportCsv(original, PORTFOLIOS), PORTFOLIOS, 'anna');

    expect(parsed.skippedLines).toHaveLength(0);
    expect(parsed.transactions).toHaveLength(2);
    expect(parsed.transactions[0]!.quantity.toString()).toBe('0.5');
    expect(parsed.transactions[0]!.pricePerUnit.toString()).toBe('42000.25');
    expect(parsed.transactions[1]!.asset).toBe('ETH');
    expect(parsed.transactions[1]!.type).toBe('sell');
  });

  it('запазва кое портфолио е чие', () => {
    const original = [
      tx('buy', '1', '100', { day: 1, portfolioId: 'anna' }),
      tx('buy', '2', '200', { day: 2, portfolioId: 'todor' }),
    ];

    const parsed = parseCsv(exportCsv(original, PORTFOLIOS), PORTFOLIOS, 'anna');

    expect(parsed.newPortfolios).toHaveLength(0);
    expect(parsed.transactions[0]!.portfolioId).toBe('anna');
    expect(parsed.transactions[1]!.portfolioId).toBe('todor');
  });

  it('създава липсващо портфолио вместо да губи реда', () => {
    const csv =
      'date,asset,type,quantity,price,fee,exchange,note,portfolio\n' +
      '2025-01-15T10:30:00Z,BTC,buy,1,100,0,Binance,,Мария\n';

    const parsed = parseCsv(csv, PORTFOLIOS, 'anna');

    expect(parsed.transactions).toHaveLength(1);
    expect(parsed.newPortfolios).toHaveLength(1);
    expect(parsed.newPortfolios[0]!.name).toBe('Мария');
    // Идентификаторът на новото портфолио съвпада с този на транзакцията.
    expect(parsed.transactions[0]!.portfolioId).toBe(parsed.newPortfolios[0]!.id);
  });

  it('стар файл без колона за портфолио отива в подразбиращото се', () => {
    const csv =
      'date,asset,type,quantity,price,fee,exchange,note\n' +
      '2025-01-15T10:30:00Z,BTC,buy,1,100,0,Binance,\n';

    const parsed = parseCsv(csv, PORTFOLIOS, 'todor');

    expect(parsed.transactions).toHaveLength(1);
    expect(parsed.transactions[0]!.portfolioId).toBe('todor');
    expect(parsed.newPortfolios).toHaveLength(0);
  });
});
