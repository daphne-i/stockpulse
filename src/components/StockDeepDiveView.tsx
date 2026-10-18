import React from 'react';
import {
  ComposedChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { ArrowLeft, Plus, Trash2, Clock, Pencil } from 'lucide-react';
import {
  MarketDataDocument,
  TickerPositionSummary,
  TradeDocument,
} from '../types/ledger';
import { formatINR, formatINR2 } from './KpiScorecards';
import { GrossToNetWaterfall } from './GrossToNetWaterfall';

interface Props {
  summary: TickerPositionSummary;
  trades: TradeDocument[];
  marketData?: MarketDataDocument;
  onBack: () => void;
  onOpenAddTradeForTicker: (ticker: string) => void;
  onEditTrade: (trade: TradeDocument) => void;
  onDeleteTrade: (tradeId: string) => void;
}

interface ChartPoint {
  date: string;
  close: number;
  buyTrades: TradeDocument[];
  sellTrades: TradeDocument[];
}

const CustomTradeTriangleDot = (props: any) => {
  const { cx, cy, payload } = props;
  if (!cx || !cy || !payload) return null;

  const hasBuy = payload.buyTrades && payload.buyTrades.length > 0;
  const hasSell = payload.sellTrades && payload.sellTrades.length > 0;

  if (!hasBuy && !hasSell) return null;

  return (
    <g>
      {hasBuy && (
        <polygon
          points={`${cx},${cy - 10} ${cx - 8},${cy + 6} ${cx + 8},${cy + 6}`}
          fill="#10b981"
          stroke="#064e3b"
          strokeWidth={1.5}
        />
      )}
      {hasSell && (
        <polygon
          points={`${cx},${cy + 10} ${cx - 8},${cy - 6} ${cx + 8},${cy - 6}`}
          fill="#f43f5e"
          stroke="#881337"
          strokeWidth={1.5}
        />
      )}
    </g>
  );
};

export const StockDeepDiveView: React.FC<Props> = ({
  summary,
  trades,
  marketData,
  onBack,
  onOpenAddTradeForTicker,
  onEditTrade,
  onDeleteTrade,
}) => {
  const dateMap = new Map<string, ChartPoint>();

  for (const pt of marketData?.history || []) {
    dateMap.set(pt.date, {
      date: pt.date,
      close: pt.close,
      buyTrades: [],
      sellTrades: [],
    });
  }

  for (const t of trades) {
    const existing = dateMap.get(t.tradeDate);
    if (existing) {
      if (t.action === 'BUY') existing.buyTrades.push(t);
      else existing.sellTrades.push(t);
    } else {
      dateMap.set(t.tradeDate, {
        date: t.tradeDate,
        close: t.price,
        buyTrades: t.action === 'BUY' ? [t] : [],
        sellTrades: t.action === 'SELL' ? [t] : [],
      });
    }
  }

  const chartSeries = Array.from(dateMap.values()).sort((a, b) =>
    a.date.localeCompare(b.date)
  );

  const stockXirrPct =
    summary.xirr !== null ? `${(summary.xirr * 100).toFixed(2)}%` : '—';
  const benchXirrPct =
    summary.benchmarkXirr !== null
      ? `${(summary.benchmarkXirr * 100).toFixed(2)}%`
      : '—';

  return (
    <div className="space-y-6">
      {/* Top Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-900 border border-slate-800 rounded-xl p-4">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-white">{summary.ticker}</h2>
              <span className="text-xs px-2 py-0.5 rounded bg-indigo-950 text-indigo-300 border border-indigo-800">
                {summary.exchange} • {summary.assetCategory}
              </span>
            </div>
            <p className="text-xs text-slate-400">
              {marketData?.companyName || summary.ticker} • Latest EOD:{' '}
              <strong className="text-white font-mono">
                {formatINR2(summary.latestPrice)}
              </strong>
            </p>
          </div>
        </div>

        <button
          onClick={() => onOpenAddTradeForTicker(summary.ticker)}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold shadow transition"
        >
          <Plus className="w-4 h-4" />
          Log {summary.ticker} Buy/Sell
        </button>
      </div>

      {/* Ticker-Specific Scorecards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <div className="text-xs text-slate-400 uppercase">
            {summary.ticker} XIRR
          </div>
          <div className="mt-1 text-2xl font-bold text-indigo-400">
            {stockXirrPct}
          </div>
          <div className="mt-1 text-xs text-slate-400">
            Nifty Shadow: {benchXirrPct}
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <div className="text-xs text-slate-400 uppercase">Open Holding</div>
          <div className="mt-1 text-2xl font-bold text-white">
            {summary.openQty} <span className="text-sm font-normal text-slate-400">sh</span>
          </div>
          <div className="mt-1 text-xs text-slate-400">
            FIFO Avg: {summary.openQty > 0 ? formatINR2(summary.avgBuyPrice) : '—'}
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <div className="text-xs text-slate-400 uppercase">Unrealized P&L</div>
          <div
            className={`mt-1 text-2xl font-bold ${
              summary.unrealizedNetPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'
            }`}
          >
            {summary.unrealizedNetPnl >= 0 ? '+' : ''}
            {formatINR(summary.unrealizedNetPnl)}
          </div>
          <div className="mt-1 text-xs text-slate-400">
            Value: {formatINR(summary.currentValue)}
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <div className="text-xs text-slate-400 uppercase">Net Realized P&L</div>
          <div
            className={`mt-1 text-2xl font-bold ${
              summary.realizedNetPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'
            }`}
          >
            {summary.realizedNetPnl >= 0 ? '+' : ''}
            {formatINR(summary.realizedNetPnl)}
          </div>
          <div className="mt-1 text-xs text-slate-400">
            Gross: {formatINR(summary.realizedGrossPnl)}
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <div className="text-xs text-slate-400 uppercase">Groww Charges Paid</div>
          <div className="mt-1 text-2xl font-bold text-rose-400">
            {formatINR2(summary.totalChargesPaid)}
          </div>
          <div className="mt-1 text-xs text-slate-400">
            Across {trades.length} executed orders
          </div>
        </div>
      </div>

      {/* Price Curve + Green/Red Buy/Sell Execution Triangles + Stock Waterfall */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
            <div>
              <h3 className="text-base font-semibold text-white">
                {summary.ticker} Price History & Execution Markers
              </h3>
              <p className="text-xs text-slate-400">
                Hover over any triangle marker to inspect exact Buy/Sell quantities and prices
              </p>
            </div>
            <div className="flex items-center gap-4 text-xs">
              <span className="flex items-center gap-1.5 text-emerald-400 font-medium">
                ▲ Buy Execution
              </span>
              <span className="flex items-center gap-1.5 text-rose-400 font-medium">
                ▼ Sell Execution
              </span>
            </div>
          </div>

          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={chartSeries}
                margin={{ top: 15, right: 20, left: 0, bottom: 5 }}
              >
                <defs>
                  <linearGradient id="priceGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis
                  dataKey="date"
                  tick={{ fill: '#94a3b8', fontSize: 11 }}
                  axisLine={{ stroke: '#334155' }}
                />
                <YAxis
                  domain={['auto', 'auto']}
                  tickFormatter={(v) => `₹${v}`}
                  tick={{ fill: '#94a3b8', fontSize: 11 }}
                  axisLine={{ stroke: '#334155' }}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload || !payload.length) return null;
                    const pt: ChartPoint = payload[0].payload;
                    return (
                      <div className="bg-slate-950 border border-slate-700 rounded-lg p-3 shadow-xl text-xs space-y-1.5">
                        <div className="font-bold text-slate-200">{pt.date}</div>
                        <div className="text-indigo-300">
                          EOD Close: <strong className="font-mono">{formatINR2(pt.close)}</strong>
                        </div>
                        {pt.buyTrades.map((bt) => (
                          <div key={bt.id} className="text-emerald-400 font-medium">
                            ▲ BOUGHT {bt.quantity} sh @ {formatINR2(bt.price)} ({bt.tradeType})
                          </div>
                        ))}
                        {pt.sellTrades.map((st) => (
                          <div key={st.id} className="text-rose-400 font-medium">
                            ▼ SOLD {st.quantity} sh @ {formatINR2(st.price)} ({st.tradeType})
                          </div>
                        ))}
                      </div>
                    );
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="close"
                  stroke="#818cf8"
                  strokeWidth={2}
                  fill="url(#priceGradient)"
                  dot={<CustomTradeTriangleDot />}
                  activeDot={{ r: 5, fill: '#f8fafc' }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        <GrossToNetWaterfall
          titlePrefix={summary.ticker}
          grossTotalPnl={summary.realizedGrossPnl + summary.unrealizedGrossPnl}
          netTotalPnl={summary.realizedNetPnl + summary.unrealizedNetPnl}
          charges={summary.chargesBreakdown}
        />
      </div>

      {/* Open FIFO Tax Lots */}
      {summary.openLots.length > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2 mb-3">
            <Clock className="w-4 h-4 text-indigo-400" />
            Active FIFO Open Buy Lots ({summary.openQty} Shares Remaining)
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {summary.openLots.map((lot) => {
              const sourceTrade = trades.find((t) => t.id === lot.buyTradeId);
              return (
                <div
                  key={lot.buyTradeId}
                  className="bg-slate-950 border border-slate-800 rounded-lg p-3 flex items-center justify-between text-xs"
                >
                  <div>
                    <div className="font-semibold text-white">
                      {lot.remainingQty} / {lot.originalQty} sh @ {formatINR2(lot.buyPrice)}
                    </div>
                    <div className="text-slate-400 mt-0.5">
                      Bought: {lot.buyDate} • Held {lot.holdingDays} days
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2 py-1 rounded font-bold ${
                        lot.taxCategory === 'LTCG'
                          ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                          : 'bg-amber-950 text-amber-300 border border-amber-800'
                      }`}
                    >
                      {lot.taxCategory}
                    </span>
                    {sourceTrade && (
                      <button
                        onClick={() => onEditTrade(sourceTrade)}
                        className="p-1.5 rounded bg-slate-800 hover:bg-indigo-600 text-slate-300 hover:text-white transition"
                        title="Edit this buy lot"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Chronological Buy/Sell Trade History List */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <div className="p-4 border-b border-slate-800">
          <h3 className="text-base font-semibold text-white">
            {summary.ticker} Buy / Sell Transaction History ({trades.length} Trades)
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-[11px] uppercase text-slate-400 bg-slate-950/50">
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-3">Action</th>
                <th className="py-3 px-3">Mode</th>
                <th className="py-3 px-3 text-right">Qty</th>
                <th className="py-3 px-3 text-right">Price</th>
                <th className="py-3 px-3 text-right">Gross Amount</th>
                <th className="py-3 px-3 text-right">Groww Charges</th>
                <th className="py-3 px-3 text-right">Net Cash Flow</th>
                <th className="py-3 px-3">Strategy Tag</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70">
              {trades.map((t) => (
                <tr key={t.id} className="hover:bg-slate-800/40">
                  <td className="py-3 px-4 font-mono text-slate-200">{t.tradeDate}</td>
                  <td className="py-3 px-3">
                    <span
                      className={`px-2 py-0.5 rounded text-xs font-bold ${
                        t.action === 'BUY'
                          ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                          : 'bg-rose-950 text-rose-400 border border-rose-800'
                      }`}
                    >
                      {t.action === 'BUY' ? '▲ BUY' : '▼ SELL'}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-xs text-slate-400">{t.tradeType}</td>
                  <td className="py-3 px-3 text-right font-mono text-white">{t.quantity}</td>
                  <td className="py-3 px-3 text-right font-mono text-slate-200">
                    {formatINR2(t.price)}
                  </td>
                  <td className="py-3 px-3 text-right font-mono text-slate-300">
                    {formatINR2(t.grossAmount)}
                  </td>
                  <td className="py-3 px-3 text-right font-mono text-rose-300 text-xs">
                    {formatINR2(t.charges.totalCharges)}
                  </td>
                  <td className="py-3 px-3 text-right font-mono font-semibold text-white">
                    {t.action === 'BUY' ? '-' : '+'}
                    {formatINR2(t.netAmount)}
                  </td>
                  <td className="py-3 px-3 text-xs text-indigo-300">
                    {t.strategyTag || '—'}
                  </td>
                  <td className="py-3 px-4 text-right space-x-2">
                    <button
                      onClick={() => onEditTrade(t)}
                      className="text-slate-400 hover:text-indigo-400 transition"
                      title="Edit trade"
                    >
                      <Pencil className="w-4 h-4 inline" />
                    </button>
                    <button
                      onClick={() => onDeleteTrade(t.id)}
                      className="text-slate-500 hover:text-rose-400 transition"
                      title="Delete trade"
                    >
                      <Trash2 className="w-4 h-4 inline" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};