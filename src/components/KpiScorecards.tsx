import React from 'react';
import { TrendingUp, TrendingDown, Wallet, Briefcase, Award, Activity } from 'lucide-react';
import { PortfolioOverviewMetrics } from '../utils/portfolioAggregator';

interface Props {
  metrics: PortfolioOverviewMetrics;
}

export const formatINR = (val: number): string =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(val);

export const formatINR2 = (val: number): string =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(val);

export const KpiScorecards: React.FC<Props> = ({ metrics }) => {
  const isUnrealizedPos = metrics.unrealizedNetPnl >= 0;
  const isRealizedPos = metrics.realizedNetPnl >= 0;
  const xirrPct = metrics.portfolioXirr !== null ? (metrics.portfolioXirr * 100).toFixed(2) : null;
  const benchPct =
    metrics.benchmarkXirr !== null ? (metrics.benchmarkXirr * 100).toFixed(2) : null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
      {/* 1. Net Invested */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-sm">
        <div className="flex items-center justify-between text-slate-400 text-xs font-medium uppercase tracking-wider">
          <span>Net Invested (Open)</span>
          <Wallet className="w-4 h-4 text-indigo-400" />
        </div>
        <div className="mt-2 text-2xl font-bold text-white">
          {formatINR(metrics.netInvested)}
        </div>
        <div className="mt-1 text-xs text-slate-400">
          Includes open lot buy charges
        </div>
      </div>

      {/* 2. Current EOD Value */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-sm">
        <div className="flex items-center justify-between text-slate-400 text-xs font-medium uppercase tracking-wider">
          <span>Current EOD Value</span>
          <Briefcase className="w-4 h-4 text-sky-400" />
        </div>
        <div className="mt-2 text-2xl font-bold text-white">
          {formatINR(metrics.currentValue)}
        </div>
        <div className="mt-1 text-xs text-slate-400">
          {metrics.tickerSummaries.filter((t) => t.openQty > 0).length} Active Holdings
        </div>
      </div>

      {/* 3. Unrealized P&L */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-sm">
        <div className="flex items-center justify-between text-slate-400 text-xs font-medium uppercase tracking-wider">
          <span>Unrealized P&L (Net)</span>
          {isUnrealizedPos ? (
            <TrendingUp className="w-4 h-4 text-emerald-400" />
          ) : (
            <TrendingDown className="w-4 h-4 text-rose-400" />
          )}
        </div>
        <div
          className={`mt-2 text-2xl font-bold ${
            isUnrealizedPos ? 'text-emerald-400' : 'text-rose-400'
          }`}
        >
          {isUnrealizedPos ? '+' : ''}
          {formatINR(metrics.unrealizedNetPnl)}
        </div>
        <div className="mt-1 text-xs text-slate-400">
          Gross: {metrics.unrealizedGrossPnl >= 0 ? '+' : ''}
          {formatINR(metrics.unrealizedGrossPnl)} ({metrics.unrealizedPnlPct.toFixed(2)}%)
        </div>
      </div>

      {/* 4. Net Realized P&L */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-sm">
        <div className="flex items-center justify-between text-slate-400 text-xs font-medium uppercase tracking-wider">
          <span>Net Realized P&L</span>
          <Award className="w-4 h-4 text-amber-400" />
        </div>
        <div
          className={`mt-2 text-2xl font-bold ${
            isRealizedPos ? 'text-emerald-400' : 'text-rose-400'
          }`}
        >
          {isRealizedPos ? '+' : ''}
          {formatINR(metrics.realizedNetPnl)}
        </div>
        <div className="mt-1 text-xs text-slate-400">
          Total Charges Paid: <span className="text-rose-300">-{formatINR2(metrics.totalChargesPaid)}</span>
        </div>
      </div>

      {/* 5. Portfolio XIRR vs Benchmark */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-sm">
        <div className="flex items-center justify-between text-slate-400 text-xs font-medium uppercase tracking-wider">
          <span>Portfolio XIRR</span>
          <Activity className="w-4 h-4 text-purple-400" />
        </div>
        <div className="mt-2 text-2xl font-bold text-white">
          {xirrPct !== null ? `${xirrPct}%` : '—'}
        </div>
        <div className="mt-1 text-xs text-slate-400">
          Nifty 50 Shadow:{' '}
          <span className="text-sky-300 font-medium">
            {benchPct !== null ? `${benchPct}%` : '—'}
          </span>
        </div>
      </div>
    </div>
  );
};