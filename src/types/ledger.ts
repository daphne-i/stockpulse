export type Exchange = 'NSE' | 'BSE';
export type AssetCategory = 'EQUITY' | 'ETF' | 'IPO';
export type TradeType = 'DELIVERY' | 'INTRADAY';
export type TradeAction = 'BUY' | 'SELL';

export interface ChargesBreakdown {
  isManualOverride: boolean;
  brokerage: number;
  stt: number;
  exchangeTxnCharge: number;
  sebiCharges: number;
  stampDuty: number;
  dpCharges: number;
  gst: number;
  totalCharges: number;
}

export interface TradeDocument {
  id: string;
  ticker: string;            // e.g., "HDFCBANK"
  exchange: Exchange;
  assetCategory: AssetCategory;
  tradeType: TradeType;
  action: TradeAction;
  tradeDate: string;         // "YYYY-MM-DD"
  quantity: number;
  price: number;
  grossAmount: number;
  charges: ChargesBreakdown;
  netAmount: number;         // BUY: gross + charges | SELL: gross - charges
  strategyTag?: string;
  notes?: string;
  createdAt: number;
}

export interface HistoricalPricePoint {
  date: string;              // "YYYY-MM-DD"
  close: number;
}

export interface MarketDataDocument {
  ticker: string;            // "HDFCBANK" or "NIFTY50"
  yahooSymbol: string;       // "HDFCBANK.NS" or "^NSEI"
  companyName: string;
  latestPrice: number;
  previousClose: number;
  dayChange: number;
  dayChangePct: number;
  lastTradeDate: string;     // "YYYY-MM-DD"
  updatedAt: string;
  history: HistoricalPricePoint[];
}

export interface OpenTaxLot {
  buyTradeId: string;
  ticker: string;
  buyDate: string;
  originalQty: number;
  remainingQty: number;
  buyPrice: number;
  buyChargesPerShare: number;
  holdingDays: number;
  taxCategory: 'STCG' | 'LTCG'; // > 365 days = LTCG
}

export interface RealizedMatch {
  ticker: string;
  tradeType: TradeType;
  buyDate: string;
  sellDate: string;
  quantity: number;
  buyPrice: number;
  sellPrice: number;
  grossPnl: number;
  allocatedCharges: number;
  netPnl: number;
  holdingDays: number;
  taxCategory: 'INTRADAY' | 'STCG' | 'LTCG';
}

export interface TickerPositionSummary {
  ticker: string;
  assetCategory: AssetCategory;
  exchange: Exchange;
  openQty: number;
  avgBuyPrice: number;       // Gross avg of remaining FIFO lots
  netInvestedValue: number;  // Includes buy charges of remaining lots
  latestPrice: number;
  currentValue: number;
  unrealizedGrossPnl: number;
  unrealizedNetPnl: number;
  unrealizedPnlPct: number;
  realizedGrossPnl: number;
  realizedNetPnl: number;
  totalChargesPaid: number;
  chargesBreakdown: Omit<ChargesBreakdown, 'isManualOverride'>;
  openLots: OpenTaxLot[];
  realizedMatches: RealizedMatch[];
  xirr: number | null;       // Annualized decimal (e.g., 0.214 = 21.4%)
  benchmarkXirr: number | null;
}