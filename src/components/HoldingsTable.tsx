import React, { useState } from 'react';
import { ArrowUpRight, Download, Pencil } from 'lucide-react';
import { AssetCategory, TickerPositionSummary } from '../types/ledger';
import { formatINR, formatINR2 } from './KpiScorecards';
import { exportHoldingsToCsv } from '../utils/exportCsv';

interface Props {
  summaries: TickerPositionSummary[];
  onSelectTicker: (ticker: string) => void;
  onEditHoldingTrades: (ticker: string) => void;
}

export const HoldingsTable: React.FC<Props> = ({
  summaries,
  onSelectTicker,
  onEditHoldingTrades,
}) => {
  const [categoryFilter, setCategoryFilter] = useState<'ALL' | AssetCategory>('ALL');
  const [showClosed, setShowClosed] = useState(true);

  const filtered = summaries.filter((s) => {
    if (categoryFilter !== 'ALL' && s.assetCategory !== categoryFilter) return false;
    if (!showClosed && s.openQty === 0) return false;
    return true;
  });

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
      <div className="p-4 border-b border-slate-800 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-white">
            Portfolio Holdings & Ticker Ledger Summary
          </h2>
          <p className="text-xs text-slate-400">
            Click any stock row to inspect its EOD Price + Buy/Sell Triangle Chart, or click Edit to modify trades
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center bg-slate-950 border border-slate-800 rounded-lg p-1 text-xs">
            {(['ALL', 'EQUITY', 'ETF', 'IPO'] as const).map((cat) => (
              <button
                key={cat}
                onClick={() => setCategoryFilter(cat)}
                className={`px-2.5 py-1 rounded-md font-medium transition ${
                  categoryFilter === cat
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          <label className="flex items-center gap-1.5 text-xs text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={showClosed}
              onChange={(e) => setShowClosed(e.target.checked)}
              className="rounded border-slate-700 bg-slate-950 text-indigo-600"
            />
            Show Exited Stocks
          </label>

          <button
            onClick={() => exportHoldingsToCsv(filtered)}
            disabled={filtered.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-xs font-medium text-slate-200 border border-slate-700 transition"
            title="Download filtered holdings as CSV"
          >
            <Download className="w-3.5 h-3.5 text-indigo-400" />
            Export CSV
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-800 text-[11px] font-semibold uppercase tracking-wider text-slate-400 bg-slate-950/50">
              <th className="py-3 px-4">Ticker</th>
              <th className="py-3 px-3">Category</th>
              <th className="py-3 px-3 text-right">Open Qty</th>
              <th className="py-3 px-3 text-right">FIFO Avg Buy</th>
              <th className="py-3 px-3 text-right">EOD Price</th>
              <th className="py-3 px-3 text-right">Current Value</th>
              <th className="py-3 px-3 text-right">Unrealized P&L</th>
              <th className="py-3 px-3 text-right">Net Realized P&L</th>
              <th className="py-3 px-3 text-right">Charges</th>
              <th className="py-3 px-3 text-right">Stock XIRR</th>
              <th className="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/70 text-sm">
            {filtered.map((item) => {
              const isUnrealPos = item.unrealizedNetPnl >= 0;
              const isRealPos = item.realizedNetPnl >= 0;

              return (
                <tr
                  key={item.ticker}
                  onClick={() => onSelectTicker(item.ticker)}
                  className="hover:bg-slate-800/60 cursor-pointer transition group"
                >
                  <td className="py-3.5 px-4 font-semibold text-white flex items-center gap-1.5">
                    <span>{item.ticker}</span>
                    <span className="text-[10px] text-slate-500 font-normal">
                      {item.exchange}
                    </span>
                    <ArrowUpRight className="w-3.5 h-3.5 text-indigo-400 opacity-0 group-hover:opacity-100 transition" />
                  </td>
                  <td className="py-3.5 px-3">
                    <span className="px-2 py-0.5 text-[10px] font-semibold rounded bg-slate-800 text-slate-300">
                      {item.assetCategory}
                    </span>
                  </td>
                  <td className="py-3.5 px-3 text-right font-mono text-slate-200">
                    {item.openQty > 0 ? (
                      item.openQty
                    ) : (
                      <span className="text-xs text-slate-500">EXITED</span>
                    )}
                  </td>
                  <td className="py-3.5 px-3 text-right font-mono text-slate-300">
                    {item.openQty > 0 ? formatINR2(item.avgBuyPrice) : '—'}
                  </td>
                  <td className="py-3.5 px-3 text-right font-mono text-white">
                    {formatINR2(item.latestPrice)}
                  </td>
                  <td className="py-3.5 px-3 text-right font-mono font-medium text-white">
                    {item.openQty > 0 ? formatINR(item.currentValue) : '—'}
                  </td>
                  <td
                    className={`py-3.5 px-3 text-right font-mono font-medium ${
                      item.openQty === 0
                        ? 'text-slate-500'
                        : isUnrealPos
                        ? 'text-emerald-400'
                        : 'text-rose-400'
                    }`}
                  >
                    {item.openQty > 0
                      ? `${isUnrealPos ? '+' : ''}${formatINR(item.unrealizedNetPnl)} (${item.unrealizedPnlPct.toFixed(1)}%)`
                      : '—'}
                  </td>
                  <td
                    className={`py-3.5 px-3 text-right font-mono font-medium ${
                      item.realizedNetPnl === 0
                        ? 'text-slate-500'
                        : isRealPos
                        ? 'text-emerald-400'
                        : 'text-rose-400'
                    }`}
                  >
                    {item.realizedNetPnl !== 0
                      ? `${isRealPos ? '+' : ''}${formatINR(item.realizedNetPnl)}`
                      : '₹0'}
                  </td>
                  <td className="py-3.5 px-3 text-right font-mono text-rose-300/80 text-xs">
                    -{formatINR2(item.totalChargesPaid)}
                  </td>
                  <td className="py-3.5 px-3 text-right font-mono font-semibold text-indigo-300">
                    {item.xirr !== null ? `${(item.xirr * 100).toFixed(1)}%` : '—'}
                  </td>
                  <td
                    className="py-3.5 px-4 text-right"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      onClick={() => onEditHoldingTrades(item.ticker)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-slate-800 hover:bg-indigo-600 text-slate-300 hover:text-white text-xs font-medium transition"
                      title={`Edit latest ${item.ticker} trade`}
                    >
                      <Pencil className="w-3 h-3" />
                      Edit
                    </button>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={11} className="py-8 text-center text-slate-500 text-sm">
                  No trades logged yet. Click "+ Log Buy / Sell" in the top bar to add your first trade.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};