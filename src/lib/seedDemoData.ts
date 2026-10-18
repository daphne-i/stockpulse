import { MarketDataDocument, TradeDocument } from '../types/ledger';
import { calculateGrowwCharges } from '../utils/growwCharges';

export function getDemoSeedData(): {
  trades: TradeDocument[];
  marketMap: Record<string, MarketDataDocument>;
} {
  const rawTrades: Array<Omit<TradeDocument, 'grossAmount' | 'charges' | 'netAmount'>> = [
    {
      id: 'demo_hdfc_1',
      ticker: 'HDFCBANK',
      exchange: 'NSE',
      assetCategory: 'EQUITY',
      tradeType: 'DELIVERY',
      action: 'BUY',
      tradeDate: '2025-11-12',
      quantity: 40,
      price: 1485,
      strategyTag: 'Core Compounder',
      createdAt: 1,
    },
    {
      id: 'demo_hdfc_2',
      ticker: 'HDFCBANK',
      exchange: 'NSE',
      assetCategory: 'EQUITY',
      tradeType: 'DELIVERY',
      action: 'BUY',
      tradeDate: '2026-01-20',
      quantity: 30,
      price: 1530,
      strategyTag: 'Dip Accumulation',
      createdAt: 2,
    },
    {
      id: 'demo_hdfc_3',
      ticker: 'HDFCBANK',
      exchange: 'NSE',
      assetCategory: 'EQUITY',
      tradeType: 'DELIVERY',
      action: 'SELL',
      tradeDate: '2026-04-15',
      quantity: 20,
      price: 1665,
      strategyTag: 'Partial Profit Booking',
      createdAt: 3,
    },
    {
      id: 'demo_hdfc_4',
      ticker: 'HDFCBANK',
      exchange: 'NSE',
      assetCategory: 'EQUITY',
      tradeType: 'DELIVERY',
      action: 'BUY',
      tradeDate: '2026-06-18',
      quantity: 25,
      price: 1595,
      strategyTag: 'Swing Breakout',
      createdAt: 4,
    },
    {
      id: 'demo_hdfc_5',
      ticker: 'HDFCBANK',
      exchange: 'NSE',
      assetCategory: 'EQUITY',
      tradeType: 'DELIVERY',
      action: 'SELL',
      tradeDate: '2026-09-08',
      quantity: 25,
      price: 1745,
      strategyTag: 'Swing Target Hit',
      createdAt: 5,
    },
    {
      id: 'demo_niftybees_1',
      ticker: 'NIFTYBEES',
      exchange: 'NSE',
      assetCategory: 'ETF',
      tradeType: 'DELIVERY',
      action: 'BUY',
      tradeDate: '2025-12-05',
      quantity: 250,
      price: 252,
      strategyTag: 'Passive Core',
      createdAt: 6,
    },
  ];

  const trades: TradeDocument[] = [];
  for (const rt of rawTrades) {
    const grossAmount = rt.quantity * rt.price;
    const charges = calculateGrowwCharges({
      ...rt,
      existingTrades: trades,
    });
    const netAmount =
      rt.action === 'BUY'
        ? grossAmount + charges.totalCharges
        : grossAmount - charges.totalCharges;
    trades.push({ ...rt, grossAmount, charges, netAmount });
  }

  // Generate smooth daily EOD series from 2025-11-01 to 2026-10-14
  const hdfcHistory = [
    { date: '2025-11-03', close: 1470 },
    { date: '2025-11-12', close: 1485 }, // BUY 40 @ 1485
    { date: '2025-12-05', close: 1560 },
    { date: '2026-01-05', close: 1550 },
    { date: '2026-01-20', close: 1530 }, // BUY 30 @ 1530
    { date: '2026-02-25', close: 1590 },
    { date: '2026-03-20', close: 1625 },
    { date: '2026-04-15', close: 1665 }, // SELL 20 @ 1665
    { date: '2026-05-18', close: 1630 },
    { date: '2026-06-18', close: 1595 }, // BUY 25 @ 1595
    { date: '2026-07-22', close: 1680 },
    { date: '2026-08-19', close: 1710 },
    { date: '2026-09-08', close: 1745 }, // SELL 25 @ 1745
    { date: '2026-09-28', close: 1730 },
    { date: '2026-10-14', close: 1782 },
  ];

  const niftyHistory = [
    { date: '2025-11-03', close: 24100 },
    { date: '2025-11-12', close: 24250 },
    { date: '2025-12-05', close: 24600 },
    { date: '2026-01-20', close: 24450 },
    { date: '2026-04-15', close: 25100 },
    { date: '2026-06-18', close: 25350 },
    { date: '2026-09-08', close: 25900 },
    { date: '2026-10-14', close: 26350 },
  ];

  const marketMap: Record<string, MarketDataDocument> = {
    HDFCBANK: {
      ticker: 'HDFCBANK',
      yahooSymbol: 'HDFCBANK.NS',
      companyName: 'HDFC Bank Limited',
      latestPrice: 1782,
      previousClose: 1765,
      dayChange: 17,
      dayChangePct: 0.96,
      lastTradeDate: '2026-10-14',
      updatedAt: '2026-10-14T16:15:00+05:30',
      history: hdfcHistory,
    },
    NIFTYBEES: {
      ticker: 'NIFTYBEES',
      yahooSymbol: 'NIFTYBEES.NS',
      companyName: 'Nippon India ETF Nifty 50 BeES',
      latestPrice: 281,
      previousClose: 279.5,
      dayChange: 1.5,
      dayChangePct: 0.54,
      lastTradeDate: '2026-10-14',
      updatedAt: '2026-10-14T16:15:00+05:30',
      history: [],
    },
    NIFTY50: {
      ticker: 'NIFTY50',
      yahooSymbol: '^NSEI',
      companyName: 'Nifty 50 Index',
      latestPrice: 26350,
      previousClose: 26210,
      dayChange: 140,
      dayChangePct: 0.53,
      lastTradeDate: '2026-10-14',
      updatedAt: '2026-10-14T16:15:00+05:30',
      history: niftyHistory,
    },
  };

  return { trades, marketMap };
}