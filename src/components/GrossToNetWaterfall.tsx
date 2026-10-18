import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  LabelList,
} from 'recharts';
import { ChargesBreakdown } from '../types/ledger';
import { formatINR, formatINR2 } from './KpiScorecards';

interface Props {
  grossTotalPnl: number;
  netTotalPnl: number;
  charges: Omit<ChargesBreakdown, 'isManualOverride'>;
  titlePrefix?: string;
}

export const GrossToNetWaterfall: React.FC<Props> = ({
  grossTotalPnl,
  netTotalPnl,
  charges,
  titlePrefix = 'Portfolio',
}) => {
  const exchAndSebi =
    Math.round((charges.exchangeTxnCharge + charges.sebiCharges) * 100) / 100;

  // Dedicated scale for friction components so ₹20-₹250 charges are clearly visible
  const feeData = [
    {
      name: 'STT (Govt Tax)',
      amount: charges.stt,
      color: '#f43f5e',
    },
    {
      name: 'Groww Brokerage',
      amount: charges.brokerage,
      color: '#fb7185',
    },
    {
      name: 'DP Charges (Sell)',
      amount: charges.dpCharges,
      color: '#e11d48',
    },
    {
      name: 'Stamp Duty',
      amount: charges.stampDuty,
      color: '#f59e0b',
    },
    {
      name: 'GST (18%)',
      amount: charges.gst,
      color: '#a855f7',
    },
    {
      name: 'Exch + SEBI',
      amount: exchAndSebi,
      color: '#38bdf8',
    },
  ].sort((a, b) => b.amount - a.amount);

  const frictionPct =
    grossTotalPnl > 0
      ? Math.min(100, Math.max(0, (charges.totalCharges / grossTotalPnl) * 100))
      : 0;
  const retainedPct = Math.max(0, 100 - frictionPct);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm flex flex-col justify-between">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-3">
        <div>
          <h3 className="text-base font-semibold text-white">
            {titlePrefix} Gross-to-Net P&L Bridge & Fee Breakdown
          </h3>
          <p className="text-xs text-slate-400">
            How much of your Gross P&L you keep vs. where your Groww & statutory charges go
          </p>
        </div>
        <div className="px-3 py-1 rounded-lg bg-rose-950/50 border border-rose-800/60 text-rose-300 text-xs font-semibold whitespace-nowrap">
          Total Friction: {formatINR2(charges.totalCharges)} (
          {frictionPct.toFixed(2)}%)
        </div>
      </div>

      {/* Top Bridge Summary Card (Gross -> Charges -> Net) */}
      <div className="bg-slate-950 border border-slate-800/80 rounded-lg p-3 mb-4">
        <div className="grid grid-cols-3 gap-2 text-xs mb-2">
          <div>
            <span className="text-slate-400 block">Gross P&L</span>
            <span className="font-mono font-bold text-emerald-400 text-sm">
              {grossTotalPnl >= 0 ? '+' : ''}
              {formatINR(grossTotalPnl)}
            </span>
          </div>
          <div className="text-center">
            <span className="text-slate-400 block">Minus Charges</span>
            <span className="font-mono font-bold text-rose-400 text-sm">
              -{formatINR2(charges.totalCharges)}
            </span>
          </div>
          <div className="text-right">
            <span className="text-slate-400 block">Net In-Hand P&L</span>
            <span className="font-mono font-bold text-indigo-400 text-sm">
              {netTotalPnl >= 0 ? '+' : ''}
              {formatINR(netTotalPnl)}
            </span>
          </div>
        </div>

        {/* Visual Proportion Bar */}
        <div className="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden flex">
          <div
            style={{ width: `${retainedPct}%` }}
            className="bg-indigo-500 h-full transition-all"
            title={`Net Retained: ${retainedPct.toFixed(2)}%`}
          />
          <div
            style={{ width: `${Math.max(frictionPct, 2)}%` }}
            className="bg-rose-500 h-full transition-all"
            title={`Charges Friction: ${frictionPct.toFixed(2)}%`}
          />
        </div>
      </div>

      {/* Zoomed Horizontal Bar Chart of Charges Breakdown */}
      <div className="h-48 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            layout="vertical"
            data={feeData}
            margin={{ top: 0, right: 55, left: 10, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
            <XAxis
              type="number"
              tickFormatter={(v) => `₹${v}`}
              tick={{ fill: '#94a3b8', fontSize: 11 }}
              axisLine={{ stroke: '#334155' }}
            />
            <YAxis
              type="category"
              dataKey="name"
              width={110}
              tick={{ fill: '#cbd5e1', fontSize: 11 }}
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
              formatter={(val: number) => [formatINR2(val), 'Charge Amount']}
            />
            <Bar dataKey="amount" radius={[0, 4, 4, 0]} barSize={16}>
              {feeData.map((entry, idx) => (
                <Cell key={`cell-${idx}`} fill={entry.color} />
              ))}
              <LabelList
                dataKey="amount"
                position="right"
                formatter={(val: number) => `₹${val.toFixed(1)}`}
                style={{ fill: '#cbd5e1', fontSize: '11px', fontFamily: 'monospace' }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};