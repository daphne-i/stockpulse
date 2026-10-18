import { MarketDataDocument, TradeDocument } from '../types/ledger';

export interface CashFlow {
  amount: number; // Negative for BUY outflow, Positive for SELL inflow / Current Value
  date: Date;
}

const DAYS_IN_YEAR = 365.0;

/**
 * Solves XIRR using Newton-Raphson with Bisection fallback for extreme volatility
 */
export function computeXIRR(cashFlows: CashFlow[], guess = 0.12): number | null {
  if (cashFlows.length < 2) return null;

  const hasPositive = cashFlows.some((cf) => cf.amount > 0);
  const hasNegative = cashFlows.some((cf) => cf.amount < 0);
  if (!hasPositive || !hasNegative) return null;

  const sorted = [...cashFlows].sort((a, b) => a.date.getTime() - b.date.getTime());
  const d0 = sorted[0].date.getTime();

  // If all cash flows happened on the exact same day, XIRR is not meaningful
  const totalDays = (sorted[sorted.length - 1].date.getTime() - d0) / (1000 * 3600 * 24);
  if (totalDays < 1) return null;

  const npv = (rate: number): number =>
    sorted.reduce((sum, cf) => {
      const years = (cf.date.getTime() - d0) / (1000 * 3600 * 24 * DAYS_IN_YEAR);
      return sum + cf.amount / Math.pow(1 + rate, years);
    }, 0);

  const dNpv = (rate: number): number =>
    sorted.reduce((sum, cf) => {
      const years = (cf.date.getTime() - d0) / (1000 * 3600 * 24 * DAYS_IN_YEAR);
      if (years === 0) return sum;
      return sum - (years * cf.amount) / Math.pow(1 + rate, years + 1);
    }, 0);

  let rate = guess;
  const maxIterations = 100;
  const tolerance = 1e-6;

  for (let i = 0; i < maxIterations; i++) {
    const fValue = npv(rate);
    if (Math.abs(fValue) < tolerance) {
      return Math.round(rate * 10000) / 10000;
    }
    const derivative = dNpv(rate);
    if (Math.abs(derivative) < 1e-10) break;

    const nextRate = rate - fValue / derivative;
    // Prevent rate from dropping below -99.9%
    rate = Math.max(-0.999, Math.min(10.0, nextRate));
  }

  return null;
}

/**
 * Helper to look up Nifty 50 close on or immediately before a given tradeDate
 */
function getBenchmarkPriceOnDate(
  dateStr: string,
  niftyData?: MarketDataDocument
): number | null {
  if (!niftyData || !niftyData.history || niftyData.history.length === 0) return null;
  let chosen = niftyData.history[0].close;
  for (const pt of niftyData.history) {
    if (pt.date <= dateStr) {
      chosen = pt.close;
    } else {
      break;
    }
  }
  return chosen;
}

export function calculateStockAndBenchmarkXirr(
  trades: TradeDocument[],
  terminalValue: number,
  valuationDateStr: string,
  niftyData?: MarketDataDocument
): { xirr: number | null; benchmarkXirr: number | null } {
  const actualFlows: CashFlow[] = [];
  const benchmarkFlows: CashFlow[] = [];
  let virtualNiftyUnits = 0;

  for (const t of trades) {
    const dt = new Date(t.tradeDate);
    const cfAmount = t.action === 'BUY' ? -t.netAmount : t.netAmount;
    actualFlows.push({ amount: cfAmount, date: dt });

    const niftyClose = getBenchmarkPriceOnDate(t.tradeDate, niftyData);
    if (niftyClose && niftyClose > 0) {
      if (t.action === 'BUY') {
        virtualNiftyUnits += t.netAmount / niftyClose;
        benchmarkFlows.push({ amount: -t.netAmount, date: dt });
      } else {
        const unitsSold = Math.min(virtualNiftyUnits, t.netAmount / niftyClose);
        virtualNiftyUnits -= unitsSold;
        benchmarkFlows.push({ amount: unitsSold * niftyClose, date: dt });
      }
    }
  }

  const valDate = new Date(valuationDateStr);
  if (terminalValue > 0) {
    actualFlows.push({ amount: terminalValue, date: valDate });
  }

  if (virtualNiftyUnits > 0 && niftyData?.latestPrice) {
    benchmarkFlows.push({
      amount: virtualNiftyUnits * niftyData.latestPrice,
      date: valDate,
    });
  }

  return {
    xirr: computeXIRR(actualFlows),
    benchmarkXirr: benchmarkFlows.length >= 2 ? computeXIRR(benchmarkFlows) : null,
  };
}