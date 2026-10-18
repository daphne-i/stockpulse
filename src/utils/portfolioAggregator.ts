import {
  ChargesBreakdown,
  MarketDataDocument,
  TickerPositionSummary,
  TradeDocument,
} from '../types/ledger';
import { processTickerLedger } from './fifoEngine';
import { calculateStockAndBenchmarkXirr } from './xirrEngine';

export interface PortfolioOverviewMetrics {
  netInvested: number;
  currentValue: number;
  unrealizedGrossPnl: number;
  unrealizedNetPnl: number;
  unrealizedPnlPct: number;
  realizedGrossPnl: number;
  realizedNetPnl: number;
  totalChargesPaid: number;
  chargesBreakdown: Omit<ChargesBreakdown, 'isManualOverride'>;
  portfolioXirr: number | null;
  benchmarkXirr: number | null;
  tickerSummaries: TickerPositionSummary[];
}

const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

export function buildPortfolioOverview(
  trades: TradeDocument[],
  marketMap: Record<string, MarketDataDocument>
): PortfolioOverviewMetrics {
  const byTicker = new Map<string, TradeDocument[]>();
  for (const t of trades) {
    const code = t.ticker.toUpperCase();
    const list = byTicker.get(code) || [];
    list.push(t);
    byTicker.set(code, list);
  }

  const niftyData = marketMap['NIFTY50'];
  const tickerSummaries: TickerPositionSummary[] = [];

  byTicker.forEach((tickerTrades, ticker) => {
    const summary = processTickerLedger(
      ticker,
      tickerTrades,
      marketMap[ticker],
      niftyData
    );
    tickerSummaries.push(summary);
  });

  // Sort holdings table: Open positions first (by Current Value DESC), then closed positions
  tickerSummaries.sort((a, b) => {
    if (a.openQty > 0 && b.openQty === 0) return -1;
    if (a.openQty === 0 && b.openQty > 0) return 1;
    return b.currentValue - a.currentValue;
  });

  let netInvested = 0;
  let openGrossCost = 0;
  let currentValue = 0;
  let unrealizedGrossPnl = 0;
  let unrealizedNetPnl = 0;
  let realizedGrossPnl = 0;
  let realizedNetPnl = 0;

  const chargesBreakdown = {
    brokerage: 0,
    stt: 0,
    exchangeTxnCharge: 0,
    sebiCharges: 0,
    stampDuty: 0,
    dpCharges: 0,
    gst: 0,
    totalCharges: 0,
  };

  for (const s of tickerSummaries) {
    netInvested = round2(netInvested + s.netInvestedValue);
    openGrossCost = round2(openGrossCost + s.openQty * s.avgBuyPrice);
    currentValue = round2(currentValue + s.currentValue);
    unrealizedGrossPnl = round2(unrealizedGrossPnl + s.unrealizedGrossPnl);
    unrealizedNetPnl = round2(unrealizedNetPnl + s.unrealizedNetPnl);
    realizedGrossPnl = round2(realizedGrossPnl + s.realizedGrossPnl);
    realizedNetPnl = round2(realizedNetPnl + s.realizedNetPnl);

    chargesBreakdown.brokerage = round2(chargesBreakdown.brokerage + s.chargesBreakdown.brokerage);
    chargesBreakdown.stt = round2(chargesBreakdown.stt + s.chargesBreakdown.stt);
    chargesBreakdown.exchangeTxnCharge = round2(
      chargesBreakdown.exchangeTxnCharge + s.chargesBreakdown.exchangeTxnCharge
    );
    chargesBreakdown.sebiCharges = round2(
      chargesBreakdown.sebiCharges + s.chargesBreakdown.sebiCharges
    );
    chargesBreakdown.stampDuty = round2(chargesBreakdown.stampDuty + s.chargesBreakdown.stampDuty);
    chargesBreakdown.dpCharges = round2(chargesBreakdown.dpCharges + s.chargesBreakdown.dpCharges);
    chargesBreakdown.gst = round2(chargesBreakdown.gst + s.chargesBreakdown.gst);
    chargesBreakdown.totalCharges = round2(
      chargesBreakdown.totalCharges + s.chargesBreakdown.totalCharges
    );
  }

  const unrealizedPnlPct =
    openGrossCost > 0 ? round2((unrealizedGrossPnl / openGrossCost) * 100) : 0;

  const todayIso = new Date().toISOString().split('T')[0];
  const valuationDate = niftyData?.lastTradeDate || todayIso;

  const { xirr: portfolioXirr, benchmarkXirr } = calculateStockAndBenchmarkXirr(
    trades,
    currentValue,
    valuationDate,
    niftyData
  );

  return {
    netInvested,
    currentValue,
    unrealizedGrossPnl,
    unrealizedNetPnl,
    unrealizedPnlPct,
    realizedGrossPnl,
    realizedNetPnl,
    totalChargesPaid: chargesBreakdown.totalCharges,
    chargesBreakdown,
    portfolioXirr,
    benchmarkXirr,
    tickerSummaries,
  };
}