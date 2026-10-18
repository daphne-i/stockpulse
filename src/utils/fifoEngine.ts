import {
  MarketDataDocument,
  OpenTaxLot,
  RealizedMatch,
  TickerPositionSummary,
  TradeDocument,
} from '../types/ledger';
import { calculateStockAndBenchmarkXirr } from './xirrEngine';

const round2 = (num: number): number => Math.round((num + Number.EPSILON) * 100) / 100;

function daysBetween(startIso: string, endIso: string): number {
  const d1 = new Date(startIso).getTime();
  const d2 = new Date(endIso).getTime();
  return Math.max(0, Math.floor((d2 - d1) / (1000 * 60 * 60 * 24)));
}

export function processTickerLedger(
  ticker: string,
  trades: TradeDocument[],
  marketData?: MarketDataDocument,
  niftyData?: MarketDataDocument
): TickerPositionSummary {
  // Sort chronologically; on the same date, process BUY before SELL
  const sorted = [...trades].sort((a, b) => {
    if (a.tradeDate !== b.tradeDate) return a.tradeDate.localeCompare(b.tradeDate);
    if (a.action !== b.action) return a.action === 'BUY' ? -1 : 1;
    return a.createdAt - b.createdAt;
  });

  const openLots: OpenTaxLot[] = [];
  const realizedMatches: RealizedMatch[] = [];

  const chargesAgg = {
    brokerage: 0,
    stt: 0,
    exchangeTxnCharge: 0,
    sebiCharges: 0,
    stampDuty: 0,
    dpCharges: 0,
    gst: 0,
    totalCharges: 0,
  };

  // Accumulate statutory charges for the Gross-to-Net Waterfall
  for (const t of sorted) {
    chargesAgg.brokerage = round2(chargesAgg.brokerage + t.charges.brokerage);
    chargesAgg.stt = round2(chargesAgg.stt + t.charges.stt);
    chargesAgg.exchangeTxnCharge = round2(chargesAgg.exchangeTxnCharge + t.charges.exchangeTxnCharge);
    chargesAgg.sebiCharges = round2(chargesAgg.sebiCharges + t.charges.sebiCharges);
    chargesAgg.stampDuty = round2(chargesAgg.stampDuty + t.charges.stampDuty);
    chargesAgg.dpCharges = round2(chargesAgg.dpCharges + t.charges.dpCharges);
    chargesAgg.gst = round2(chargesAgg.gst + t.charges.gst);
    chargesAgg.totalCharges = round2(chargesAgg.totalCharges + t.charges.totalCharges);
  }

  // BUCKET 1: INTRADAY TRADES (Grouped by Date)
  const intradayByDate = new Map<string, TradeDocument[]>();
  for (const t of sorted.filter((x) => x.tradeType === 'INTRADAY')) {
    const list = intradayByDate.get(t.tradeDate) || [];
    list.push(t);
    intradayByDate.set(t.tradeDate, list);
  }

  intradayByDate.forEach((dayTrades, date) => {
    let buyQty = 0, buyGross = 0, buyCharges = 0;
    let sellQty = 0, sellGross = 0, sellCharges = 0;

    for (const dt of dayTrades) {
      if (dt.action === 'BUY') {
        buyQty += dt.quantity;
        buyGross += dt.grossAmount;
        buyCharges += dt.charges.totalCharges;
      } else {
        sellQty += dt.quantity;
        sellGross += dt.grossAmount;
        sellCharges += dt.charges.totalCharges;
      }
    }

    const matchedQty = Math.min(buyQty, sellQty);
    if (matchedQty > 0) {
      const avgBuy = buyGross / buyQty;
      const avgSell = sellGross / sellQty;
      const grossPnl = round2(matchedQty * (avgSell - avgBuy));
      const allocatedCharges = round2(buyCharges + sellCharges);

      realizedMatches.push({
        ticker,
        tradeType: 'INTRADAY',
        buyDate: date,
        sellDate: date,
        quantity: matchedQty,
        buyPrice: round2(avgBuy),
        sellPrice: round2(avgSell),
        grossPnl,
        allocatedCharges,
        netPnl: round2(grossPnl - allocatedCharges),
        holdingDays: 0,
        taxCategory: 'INTRADAY',
      });
    }
  });

  // BUCKET 2: DELIVERY TRADES (Strict FIFO Queue)
  const todayIso = new Date().toISOString().split('T')[0];
  const deliveryTrades = sorted.filter((x) => x.tradeType === 'DELIVERY');

  for (const t of deliveryTrades) {
    if (t.action === 'BUY') {
      const holdDays = daysBetween(t.tradeDate, todayIso);
      openLots.push({
        buyTradeId: t.id,
        ticker,
        buyDate: t.tradeDate,
        originalQty: t.quantity,
        remainingQty: t.quantity,
        buyPrice: t.price,
        buyChargesPerShare: t.charges.totalCharges / t.quantity,
        holdingDays: holdDays,
        taxCategory: holdDays > 365 ? 'LTCG' : 'STCG',
      });
    } else if (t.action === 'SELL') {
      let qtyToMatch = t.quantity;
      const sellChargesPerShare = t.charges.totalCharges / t.quantity;

      for (const lot of openLots) {
        if (qtyToMatch <= 0) break;
        if (lot.remainingQty <= 0) continue;

        const matched = Math.min(lot.remainingQty, qtyToMatch);
        lot.remainingQty -= matched;
        qtyToMatch -= matched;

        const holdDays = daysBetween(lot.buyDate, t.tradeDate);
        const grossPnl = round2(matched * (t.price - lot.buyPrice));
        const allocatedCharges = round2(
          matched * (lot.buyChargesPerShare + sellChargesPerShare)
        );

        realizedMatches.push({
          ticker,
          tradeType: 'DELIVERY',
          buyDate: lot.buyDate,
          sellDate: t.tradeDate,
          quantity: matched,
          buyPrice: lot.buyPrice,
          sellPrice: t.price,
          grossPnl,
          allocatedCharges,
          netPnl: round2(grossPnl - allocatedCharges),
          holdingDays: holdDays,
          taxCategory: holdDays > 365 ? 'LTCG' : 'STCG',
        });
      }
    }
  }

  // Filter active open lots
  const activeLots = openLots.filter((l) => l.remainingQty > 0);
  const openQty = activeLots.reduce((acc, l) => acc + l.remainingQty, 0);
  const openGrossCost = activeLots.reduce((acc, l) => acc + l.remainingQty * l.buyPrice, 0);
  const openBuyCharges = activeLots.reduce(
    (acc, l) => acc + l.remainingQty * l.buyChargesPerShare,
    0
  );

  const avgBuyPrice = openQty > 0 ? round2(openGrossCost / openQty) : 0;
  const netInvestedValue = round2(openGrossCost + openBuyCharges);

  const latestPrice =
    marketData?.latestPrice ?? (sorted.length > 0 ? sorted[sorted.length - 1].price : 0);
  const currentValue = round2(openQty * latestPrice);

  const unrealizedGrossPnl = openQty > 0 ? round2(currentValue - openGrossCost) : 0;
  const unrealizedNetPnl = openQty > 0 ? round2(currentValue - netInvestedValue) : 0;
  const unrealizedPnlPct =
    openGrossCost > 0 ? round2((unrealizedGrossPnl / openGrossCost) * 100) : 0;

  const realizedGrossPnl = round2(
    realizedMatches.reduce((acc, m) => acc + m.grossPnl, 0)
  );
  const realizedNetPnl = round2(
    realizedMatches.reduce((acc, m) => acc + m.netPnl, 0)
  );

  // Calculate Stock XIRR & Corresponding Nifty 50 Benchmark XIRR
  const valuationDate = marketData?.lastTradeDate || todayIso;
  const { xirr, benchmarkXirr } = calculateStockAndBenchmarkXirr(
    sorted,
    currentValue,
    valuationDate,
    niftyData
  );

  const sampleTrade = sorted[0];

  return {
    ticker,
    assetCategory: sampleTrade?.assetCategory || 'EQUITY',
    exchange: sampleTrade?.exchange || 'NSE',
    openQty,
    avgBuyPrice,
    netInvestedValue,
    latestPrice,
    currentValue,
    unrealizedGrossPnl,
    unrealizedNetPnl,
    unrealizedPnlPct,
    realizedGrossPnl,
    realizedNetPnl,
    totalChargesPaid: chargesAgg.totalCharges,
    chargesBreakdown: chargesAgg,
    openLots: activeLots,
    realizedMatches,
    xirr,
    benchmarkXirr,
  };
}