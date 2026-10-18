import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Legend,
} from 'recharts';
import { PortfolioOverviewMetrics } from '../utils/portfolioAggregator';

interface Props {
  metrics: PortfolioOverviewMetrics;
}

export const XirrBenchmarkChart: React.FC<Props> = ({ metrics }) => {
  const portfolioXirrPct =
    metrics.portfolioXirr !== null ? Number((metrics.portfolioXirr * 100).toFixed(2)) : 0;
  const niftyXirrPct =
    metrics.benchmarkXirr !== null ? Number((metrics.benchmarkXirr * 100).toFixed(2)) : 0;
  const alpha = Number((portfolioXirrPct - niftyXirrPct).toFixed(2));

  const chartData = [
    {
      name: 'OVERALL PORTFOLIO',
      YourXIRR: portfolioXirrPct,
      Nifty50Shadow: niftyXirrPct,
    },
    ...metrics.tickerSummaries.map((s) => ({
      name: s.ticker,
      YourXIRR: s.xirr !== null ? Number((s.xirr * 100).toFixed(2)) : 0,
      Nifty50Shadow:
        s.benchmarkXirr !== null ? Number((s.benchmarkXirr * 100).toFixed(2)) : niftyXirrPct,
    })),
  ];

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm flex flex-col justify-between">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <h3 className="text-base font-semibold text-white">
            True Cash-Flow XIRR vs. Nifty 50 Shadow
          </h3>
          <p className="text-xs text-slate-400">
            Compares your exact cash-flow dates against investing those same rupees in Nifty 50
          </p>
        </div>
        <div
          className={`px-3 py-1 rounded-lg border text-xs font-semibold ${
            alpha >= 0
              ? 'bg-emerald-950/60 border-emerald-700/60 text-emerald-300'
              : 'bg-rose-950/60 border-rose-700/60 text-rose-300'
          }`}
        >
          Alpha: {alpha >= 0 ? `+${alpha}%` : `${alpha}%`} vs Nifty
        </div>
      </div>

      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 10, right: 15, left: -10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis
              dataKey="name"
              tick={{ fill: '#94a3b8', fontSize: 11 }}
              axisLine={{ stroke: '#334155' }}
            />
            <YAxis
              tickFormatter={(v) => `${v}%`}
              tick={{ fill: '#94a3b8', fontSize: 11 }}
              axisLine={{ stroke: '#334155' }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#0f172a',
                borderColor: '#334155',
                borderRadius: '0.5rem',
                color: '#f8fafc',
                fontSize: '12px',
              }}
              formatter={(value: any) => {
                if (value === null || value === undefined) return ['0.00%', ''];
                const num = Number(value);
                return [isNaN(num) ? '0.00%' : `${num.toFixed(2)}%`, ''];
              }}
            />
            <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '8px' }} />
            <ReferenceLine y={0} stroke="#475569" />
            <Bar
              dataKey="YourXIRR"
              name="Actual XIRR (%)"
              fill="#6366f1"
              radius={[4, 4, 0, 0]}
            />
            <Bar
              dataKey="Nifty50Shadow"
              name="Nifty 50 Shadow XIRR (%)"
              fill="#38bdf8"
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};