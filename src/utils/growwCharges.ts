import {
  AssetCategory,
  ChargesBreakdown,
  Exchange,
  TradeAction,
  TradeDocument,
  TradeType,
} from '../types/ledger';

const round2 = (num: number): number => Math.round((num + Number.EPSILON) * 100) / 100;

export interface ChargeInput {
  ticker: string;
  exchange: Exchange;
  assetCategory: AssetCategory;
  tradeType: TradeType;
  action: TradeAction;
  tradeDate: string;
  quantity: number;
  price: number;
  existingTrades?: TradeDocument[]; // Used to check if DP charge was already levied today
  manualTotalOverride?: number | null;
}

export function calculateGrowwCharges(input: ChargeInput): ChargesBreakdown {
  const turnover = input.quantity * input.price;

  // If user manually overrides total charges from contract note
  if (
    input.manualTotalOverride !== undefined &&
    input.manualTotalOverride !== null &&
    !Number.isNaN(input.manualTotalOverride)
  ) {
    return {
      isManualOverride: true,
      brokerage: 0,
      stt: 0,
      exchangeTxnCharge: 0,
      sebiCharges: 0,
      stampDuty: 0,
      dpCharges: 0,
      gst: 0,
      totalCharges: round2(input.manualTotalOverride),
    };
  }

  // 1. IPO Buy Allotment has 0 charges across the board
  if (input.assetCategory === 'IPO' && input.action === 'BUY') {
    return {
      isManualOverride: false,
      brokerage: 0,
      stt: 0,
      exchangeTxnCharge: 0,
      sebiCharges: 0,
      stampDuty: 0,
      dpCharges: 0,
      gst: 0,
      totalCharges: 0,
    };
  }

  // 2. Groww Brokerage: 0.1% of turnover, min ₹5 (capped at 2.5% if tiny order), max ₹20
  const rawBrokerage = turnover * 0.001;
  const minBrokerage = Math.min(5, turnover * 0.025);
  const brokerage = round2(Math.min(20, Math.max(minBrokerage, rawBrokerage)));

  // 3. STT (Securities Transaction Tax)
  let stt = 0;
  if (input.tradeType === 'INTRADAY') {
    // Intraday: 0.025% only on SELL leg
    stt = input.action === 'SELL' ? round2(turnover * 0.00025) : 0;
  } else if (input.assetCategory === 'ETF') {
    // ETF Delivery: 0.001% only on SELL leg
    stt = input.action === 'SELL' ? round2(turnover * 0.00001) : 0;
  } else {
    // Standard Equity Delivery (or IPO Sell): 0.1% on both BUY and SELL
    stt = round2(turnover * 0.001);
  }

  // 4. Exchange Transaction Charges (NSE: 0.00297%, BSE: 0.00375%)
  const exchRate = input.exchange === 'NSE' ? 0.0000297 : 0.0000375;
  const exchangeTxnCharge = round2(turnover * exchRate);

  // 5. SEBI Turnover Fees (0.0001% = ₹10 per crore)
  const sebiCharges = round2(turnover * 0.000001);

  // 6. Stamp Duty (Only on BUY leg: 0.015% Delivery, 0.003% Intraday)
  let stampDuty = 0;
  if (input.action === 'BUY') {
    stampDuty = round2(
      turnover * (input.tradeType === 'DELIVERY' ? 0.00015 : 0.00003)
    );
  }

  // 7. DP Charges (Delivery SELL only, ₹0 if turnover < ₹100, charged once per scrip per day)
  let dpBase = 0;
  if (input.tradeType === 'DELIVERY' && input.action === 'SELL' && turnover >= 100) {
    const alreadyChargedToday = (input.existingTrades || []).some(
      (t) =>
        t.ticker.toUpperCase() === input.ticker.toUpperCase() &&
        t.tradeDate === input.tradeDate &&
        t.tradeType === 'DELIVERY' &&
        t.action === 'SELL' &&
        t.charges.dpCharges > 0
    );
    if (!alreadyChargedToday) {
      // Groww ₹16.50 + CDSL ₹3.50 = ₹20.00 base (+ 18% GST = ₹23.60 total)
      dpBase = 20.0;
    }
  }
  const dpCharges = round2(dpBase * 1.18); // Stored inclusive of DP GST for waterfall clarity

  // 8. GST (18% on Brokerage + Exchange Txn + SEBI)
  const gst = round2((brokerage + exchangeTxnCharge + sebiCharges) * 0.18);

  const totalCharges = round2(
    brokerage + stt + exchangeTxnCharge + sebiCharges + stampDuty + dpCharges + gst
  );

  return {
    isManualOverride: false,
    brokerage,
    stt,
    exchangeTxnCharge,
    sebiCharges,
    stampDuty,
    dpCharges,
    gst,
    totalCharges,
  };
}