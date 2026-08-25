import { Decimal, ZERO, divSafe } from './money';
import { ASSET_IDS, type AssetId } from './assets';
import {
  isInflow,
  isOutflow,
  type CostBasisMethod,
  type Holding,
  type PortfolioSummary,
  type Quote,
  type Quotes,
  type Transaction,
  type TxType,
} from './types';

/**
 * Всички изчисления по портфолиото.
 *
 *   Наличност           = Σ(buy + transferIn) − Σ(sell + transferOut)
 *   Средна цена         = Σ(qty_buy × price_buy + fee_buy) / Σ qty_buy
 *   Инвестирана сума    = Наличност × Средна цена
 *   Текуща стойност     = Наличност × Текуща цена
 *   Нереализирана П/З   = Текуща стойност − Инвестирана сума
 *   Нереализирана П/З % = (Нереализирана П/З / Инвестирана сума) × 100
 *   Реализирана П/З     = Σ [ qty_sell × (price_sell − себестойност) − fee ]
 *
 * Себестойността при продажба зависи от избрания метод — средно претеглена
 * (движеща се средна към момента на продажбата) или FIFO.
 */

interface CoreResult {
  quantity: Decimal;
  averageCost: Decimal;
  invested: Decimal;
  realized: Decimal;
}

/** При еднаква дата обработваме първо входящите движения. */
const rank = (type: TxType): number => (isInflow(type) ? 0 : 1);

function chronological(transactions: Transaction[]): Transaction[] {
  return [...transactions].sort((a, b) => {
    const diff = a.date.getTime() - b.date.getTime();
    return diff !== 0 ? diff : rank(a.type) - rank(b.type);
  });
}

/**
 * Средно претеглена цена.
 *
 * Средната цена се формира само от покупките. Продажбите и трансферите
 * намаляват количеството, но не местят средната цена — затова тя остава
 * стабилна и след частична продажба. `transferIn` увеличава наличността без
 * себестойност; ако искаш активът да влезе в средната цена, въведи го като
 * покупка.
 */
function averageCostMethod(transactions: Transaction[]): CoreResult {
  let totalBuyQuantity = ZERO;
  let totalBuyCost = ZERO;

  // Движеща се средна — за коректна реализирана П/З към момента на продажбата.
  let runningQuantity = ZERO;
  let runningCost = ZERO;
  let realized = ZERO;

  for (const tx of transactions) {
    switch (tx.type) {
      case 'buy': {
        const cost = tx.quantity.times(tx.pricePerUnit).plus(tx.fee);
        totalBuyQuantity = totalBuyQuantity.plus(tx.quantity);
        totalBuyCost = totalBuyCost.plus(cost);
        runningQuantity = runningQuantity.plus(tx.quantity);
        runningCost = runningCost.plus(cost);
        break;
      }
      case 'transferIn': {
        runningQuantity = runningQuantity.plus(tx.quantity);
        break;
      }
      case 'sell': {
        const costBasis = divSafe(runningCost, runningQuantity);
        realized = realized.plus(
          tx.quantity.times(tx.pricePerUnit.minus(costBasis)).minus(tx.fee),
        );
        runningCost = runningCost.minus(costBasis.times(tx.quantity));
        runningQuantity = runningQuantity.minus(tx.quantity);
        break;
      }
      case 'transferOut': {
        const costBasis = divSafe(runningCost, runningQuantity);
        runningCost = runningCost.minus(costBasis.times(tx.quantity));
        runningQuantity = runningQuantity.minus(tx.quantity);
        break;
      }
    }
  }

  const averageCost = divSafe(totalBuyCost, totalBuyQuantity);

  return {
    quantity: runningQuantity,
    averageCost,
    invested: runningQuantity.times(averageCost),
    realized,
  };
}

interface Lot {
  quantity: Decimal;
  /** Себестойност за единица, включително таксата при покупка. */
  costPerUnit: Decimal;
}

/** Отнема количество от началото на опашката с партиди. */
function consume(quantity: Decimal, lots: Lot[]): Lot[] {
  let remaining = quantity;
  const consumed: Lot[] = [];

  while (remaining.gt(0) && lots.length > 0) {
    const first = lots[0]!;

    if (first.quantity.lte(remaining)) {
      consumed.push(first);
      remaining = remaining.minus(first.quantity);
      lots.shift();
    } else {
      consumed.push({ quantity: remaining, costPerUnit: first.costPerUnit });
      first.quantity = first.quantity.minus(remaining);
      remaining = ZERO;
    }
  }

  return consumed;
}

/**
 * FIFO — първите придобити единици се продават първи. `transferIn` образува
 * партида със себестойност `pricePerUnit` (въведи 0, ако активът е получен
 * без придобивна стойност).
 */
function fifoMethod(transactions: Transaction[]): CoreResult {
  const lots: Lot[] = [];
  let realized = ZERO;

  for (const tx of transactions) {
    switch (tx.type) {
      case 'buy': {
        if (tx.quantity.lte(0)) break;
        const unitCost = divSafe(
          tx.quantity.times(tx.pricePerUnit).plus(tx.fee),
          tx.quantity,
        );
        lots.push({ quantity: tx.quantity, costPerUnit: unitCost });
        break;
      }
      case 'transferIn': {
        if (tx.quantity.lte(0)) break;
        lots.push({ quantity: tx.quantity, costPerUnit: tx.pricePerUnit });
        break;
      }
      case 'sell': {
        let proceeds = ZERO;
        for (const piece of consume(tx.quantity, lots)) {
          proceeds = proceeds.plus(
            piece.quantity.times(tx.pricePerUnit.minus(piece.costPerUnit)),
          );
        }
        realized = realized.plus(proceeds.minus(tx.fee));
        break;
      }
      case 'transferOut': {
        // Изнасянето навън не реализира печалба — само маха партиди.
        consume(tx.quantity, lots);
        break;
      }
    }
  }

  const quantity = lots.reduce((sum, lot) => sum.plus(lot.quantity), ZERO);
  const invested = lots.reduce(
    (sum, lot) => sum.plus(lot.quantity.times(lot.costPerUnit)),
    ZERO,
  );

  return {
    quantity,
    averageCost: divSafe(invested, quantity),
    invested,
    realized,
  };
}

function emptyHolding(asset: AssetId, quote?: Quote): Holding {
  const price = quote?.price ?? ZERO;
  const change = quote?.change24hPercent ?? ZERO;

  return {
    asset,
    quantity: ZERO,
    averageCost: ZERO,
    invested: ZERO,
    realizedProfitLoss: ZERO,
    currentPrice: price,
    change24hPercent: change,
    hasActivity: false,
    currentValue: ZERO,
    unrealizedProfitLoss: ZERO,
    unrealizedProfitLossPercent: ZERO,
    value24hAgo: ZERO,
    change24hValue: ZERO,
  };
}

/** Позиция по един актив. */
export function computeHolding(
  asset: AssetId,
  transactions: Transaction[],
  quote: Quote | undefined,
  method: CostBasisMethod,
): Holding {
  const own = chronological(transactions.filter((tx) => tx.asset === asset));
  if (own.length === 0) return emptyHolding(asset, quote);

  const core = method === 'fifo' ? fifoMethod(own) : averageCostMethod(own);

  const currentPrice = quote?.price ?? ZERO;
  const change24hPercent = quote?.change24hPercent ?? ZERO;

  const currentValue = core.quantity.times(currentPrice);
  const unrealizedProfitLoss = currentValue.minus(core.invested);

  // Цена преди 24ч, изведена от процентната промяна.
  const factor = new Decimal(1).plus(change24hPercent.div(100));
  const price24hAgo = factor.isZero() ? currentPrice : currentPrice.div(factor);
  const value24hAgo = core.quantity.times(price24hAgo);

  return {
    asset,
    quantity: core.quantity,
    averageCost: core.averageCost,
    invested: core.invested,
    realizedProfitLoss: core.realized,
    currentPrice,
    change24hPercent,
    hasActivity: true,
    currentValue,
    unrealizedProfitLoss,
    unrealizedProfitLossPercent: core.invested.isZero()
      ? ZERO
      : unrealizedProfitLoss.div(core.invested).times(100),
    value24hAgo,
    change24hValue: currentValue.minus(value24hAgo),
  };
}

/** Цялото портфолио. */
export function computeSummary(
  transactions: Transaction[],
  quotes: Quotes,
  method: CostBasisMethod,
): PortfolioSummary {
  const holdings = ASSET_IDS.map((asset) =>
    computeHolding(asset, transactions, quotes[asset], method),
  );

  const totalValue = holdings.reduce((sum, h) => sum.plus(h.currentValue), ZERO);
  const totalInvested = holdings.reduce((sum, h) => sum.plus(h.invested), ZERO);
  const totalValue24hAgo = holdings.reduce((sum, h) => sum.plus(h.value24hAgo), ZERO);
  const totalProfitLoss = totalValue.minus(totalInvested);
  const change24hValue = totalValue.minus(totalValue24hAgo);

  const allocation = {} as Record<AssetId, Decimal>;
  for (const holding of holdings) {
    allocation[holding.asset] = totalValue.isZero()
      ? ZERO
      : holding.currentValue.div(totalValue).times(100);
  }

  return {
    holdings,
    totalValue,
    totalInvested,
    totalProfitLoss,
    totalProfitLossPercent: totalInvested.isZero()
      ? ZERO
      : totalProfitLoss.div(totalInvested).times(100),
    totalRealizedProfitLoss: holdings.reduce(
      (sum, h) => sum.plus(h.realizedProfitLoss),
      ZERO,
    ),
    change24hValue,
    change24hPercent: totalValue24hAgo.isZero()
      ? ZERO
      : change24hValue.div(totalValue24hAgo).times(100),
    allocation,
    hasAnyActivity: holdings.some((h) => h.hasActivity),
  };
}

/**
 * Налично количество — за валидация на продажби. `excludeId` позволява при
 * редакция да игнорираме самата транзакция.
 */
export function availableQuantity(
  asset: AssetId,
  transactions: Transaction[],
  excludeId?: string,
): Decimal {
  return transactions.reduce((total, tx) => {
    if (tx.asset !== asset) return total;
    if (excludeId && tx.id === excludeId) return total;
    if (isInflow(tx.type)) return total.plus(tx.quantity);
    if (isOutflow(tx.type)) return total.minus(tx.quantity);
    return total;
  }, ZERO);
}
