import React, { useEffect, useMemo, useState } from 'react';
import { X, Calculator } from 'lucide-react';
import {
  AssetCategory,
  Exchange,
  TradeAction,
  TradeDocument,
  TradeType,
} from '../types/ledger';
import { calculateGrowwCharges } from '../utils/growwCharges';
import { formatINR2 } from './KpiScorecards';

interface Props {
  isOpen: boolean;
  defaultTicker?: string;
  editingTrade?: TradeDocument | null;
  existingTrades: TradeDocument[];
  onClose: () => void;
  onSaveTrade: (trade: TradeDocument) => Promise<void>;
}

export const TradeEntryModal: React.FC<Props> = ({
  isOpen,
  defaultTicker = '',
  editingTrade = null,
  existingTrades,
  onClose,
  onSaveTrade,
}) => {
  const [ticker, setTicker] = useState(defaultTicker);
  const [exchange, setExchange] = useState<Exchange>('NSE');
  const [assetCategory, setAssetCategory] = useState<AssetCategory>('EQUITY');
  const [tradeType, setTradeType] = useState<TradeType>('DELIVERY');
  const [action, setAction] = useState<TradeAction>('BUY');
  const [tradeDate, setTradeDate] = useState(new Date().toISOString().split('T')[0]);
  const [quantity, setQuantity] = useState<string>('10');
  const [price, setPrice] = useState<string>('1650');
  const [strategyTag, setStrategyTag] = useState('Core Compounder');
  const [useManualCharges, setUseManualCharges] = useState(false);
  const [manualChargesInput, setManualChargesInput] = useState<string>('0');
  const [saving, setSaving] = useState(false);

  // Sync form fields whenever modal opens for either Add or Edit mode
  useEffect(() => {
    if (!isOpen) return;
    if (editingTrade) {
      setTicker(editingTrade.ticker);
      setExchange(editingTrade.exchange);
      setAssetCategory(editingTrade.assetCategory);
      setTradeType(editingTrade.tradeType);
      setAction(editingTrade.action);
      setTradeDate(editingTrade.tradeDate);
      setQuantity(String(editingTrade.quantity));
      setPrice(String(editingTrade.price));
      setStrategyTag(editingTrade.strategyTag || '');
      setUseManualCharges(Boolean(editingTrade.charges.isManualOverride));
      setManualChargesInput(String(editingTrade.charges.totalCharges));
    } else {
      setTicker(defaultTicker);
      setExchange('NSE');
      setAssetCategory('EQUITY');
      setTradeType('DELIVERY');
      setAction('BUY');
      setTradeDate(new Date().toISOString().split('T')[0]);
      setQuantity('10');
      setPrice('1650');
      setStrategyTag('Core Compounder');
      setUseManualCharges(false);
      setManualChargesInput('0');
    }
  }, [isOpen, editingTrade, defaultTicker]);

  const qtyNum = Math.max(0, Number(quantity) || 0);
  const priceNum = Math.max(0, Number(price) || 0);
  const grossAmount = Math.round(qtyNum * priceNum * 100) / 100;

  // Exclude the trade currently being edited when checking same-day DP charges
  const otherTrades = useMemo(
    () =>
      editingTrade
        ? existingTrades.filter((t) => t.id !== editingTrade.id)
        : existingTrades,
    [existingTrades, editingTrade]
  );

  const charges = useMemo(() => {
    return calculateGrowwCharges({
      ticker: ticker.trim().toUpperCase(),
      exchange,
      assetCategory,
      tradeType,
      action,
      tradeDate,
      quantity: qtyNum,
      price: priceNum,
      existingTrades: otherTrades,
      manualTotalOverride: useManualCharges ? Number(manualChargesInput) : null,
    });
  }, [
    ticker,
    exchange,
    assetCategory,
    tradeType,
    action,
    tradeDate,
    qtyNum,
    priceNum,
    otherTrades,
    useManualCharges,
    manualChargesInput,
  ]);

  const netAmount =
    action === 'BUY'
      ? Math.round((grossAmount + charges.totalCharges) * 100) / 100
      : Math.round((grossAmount - charges.totalCharges) * 100) / 100;

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticker.trim() || qtyNum <= 0 || priceNum <= 0) return;
    setSaving(true);
    try {
      const doc: TradeDocument = {
        id:
          editingTrade?.id ||
          `trd_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        ticker: ticker.trim().toUpperCase(),
        exchange,
        assetCategory,
        tradeType: assetCategory === 'IPO' ? 'DELIVERY' : tradeType,
        action,
        tradeDate,
        quantity: qtyNum,
        price: priceNum,
        grossAmount,
        charges,
        netAmount,
        strategyTag: strategyTag.trim() || undefined,
        createdAt: editingTrade?.createdAt || Date.now(),
      };
      await onSaveTrade(doc);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-xl w-full overflow-hidden shadow-2xl">
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <h3 className="text-lg font-bold text-white">
            {editingTrade
              ? `Edit ${editingTrade.ticker} Trade (${editingTrade.tradeDate})`
              : 'Log Stock / ETF / IPO Trade'}
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Action Toggle: BUY vs SELL */}
          <div className="grid grid-cols-2 gap-2 p-1 bg-slate-950 rounded-xl border border-slate-800">
            <button
              type="button"
              onClick={() => setAction('BUY')}
              className={`py-2 rounded-lg font-bold text-sm transition ${
                action === 'BUY'
                  ? 'bg-emerald-600 text-white shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              BUY (▲ Green Marker)
            </button>
            <button
              type="button"
              onClick={() => setAction('SELL')}
              className={`py-2 rounded-lg font-bold text-sm transition ${
                action === 'SELL'
                  ? 'bg-rose-600 text-white shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              SELL (▼ Red Marker)
            </button>
          </div>

          {/* Ticker, Exchange, Category */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="col-span-2">
              <label className="block text-xs text-slate-400 mb-1">NSE/BSE Ticker</label>
              <input
                type="text"
                required
                placeholder="e.g. HDFCBANK"
                value={ticker}
                onChange={(e) => setTicker(e.target.value.toUpperCase())}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono uppercase focus:border-indigo-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1">Exchange</label>
              <select
                value={exchange}
                onChange={(e) => setExchange(e.target.value as Exchange)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white"
              >
                <option value="NSE">NSE</option>
                <option value="BSE">BSE</option>
              </select>
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1">Category</label>
              <select
                value={assetCategory}
                onChange={(e) => setAssetCategory(e.target.value as AssetCategory)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white"
              >
                <option value="EQUITY">EQUITY</option>
                <option value="ETF">ETF</option>
                <option value="IPO">IPO</option>
              </select>
            </div>
          </div>

          {/* Trade Type, Date, Quantity, Execution Price */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Trade Mode</label>
              <select
                value={tradeType}
                disabled={assetCategory === 'IPO'}
                onChange={(e) => setTradeType(e.target.value as TradeType)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white disabled:opacity-50"
              >
                <option value="DELIVERY">DELIVERY</option>
                <option value="INTRADAY">INTRADAY</option>
              </select>
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1">Trade Date</label>
              <input
                type="date"
                required
                value={tradeDate}
                onChange={(e) => setTradeDate(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-2 text-white text-sm"
              />
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1">Quantity</label>
              <input
                type="number"
                min="1"
                step="1"
                required
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono"
              />
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1">Price (₹)</label>
              <input
                type="number"
                min="0.01"
                step="0.01"
                required
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono"
              />
            </div>
          </div>

          {/* Strategy Tag */}
          <div>
            <label className="block text-xs text-slate-400 mb-1">Strategy / Thesis Tag</label>
            <input
              type="text"
              placeholder="e.g. Core Compounder, Swing Breakout, Listing Flip"
              value={strategyTag}
              onChange={(e) => setStrategyTag(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm"
            />
          </div>

          {/* Live Groww Brokerage & Statutory Charges Preview */}
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-indigo-400 flex items-center gap-1.5">
                <Calculator className="w-3.5 h-3.5" />
                Groww Brokerage & Statutory Taxes
              </span>
              <label className="flex items-center gap-1.5 text-xs text-slate-400 cursor-pointer">
                <input
                  type="checkbox"
                  checked={useManualCharges}
                  onChange={(e) => setUseManualCharges(e.target.checked)}
                />
                Manual Override
              </label>
            </div>

            {useManualCharges ? (
              <div>
                <label className="block text-xs text-slate-400 mb-1">
                  Total Contract Note Charges (₹)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={manualChargesInput}
                  onChange={(e) => setManualChargesInput(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-white font-mono text-sm"
                />
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-2 text-xs text-slate-300 pt-1">
                <div>Brokerage: <span className="font-mono text-white">₹{charges.brokerage.toFixed(2)}</span></div>
                <div>STT: <span className="font-mono text-white">₹{charges.stt.toFixed(2)}</span></div>
                <div>DP Charge: <span className="font-mono text-white">₹{charges.dpCharges.toFixed(2)}</span></div>
                <div>Stamp Duty: <span className="font-mono text-white">₹{charges.stampDuty.toFixed(2)}</span></div>
                <div>Exch+SEBI: <span className="font-mono text-white">₹{(charges.exchangeTxnCharge + charges.sebiCharges).toFixed(2)}</span></div>
                <div>GST (18%): <span className="font-mono text-white">₹{charges.gst.toFixed(2)}</span></div>
              </div>
            )}

            <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-sm">
              <span className="text-slate-400">
                Gross: <strong className="text-white font-mono">{formatINR2(grossAmount)}</strong> | Charges:{' '}
                <strong className="text-rose-400 font-mono">₹{charges.totalCharges.toFixed(2)}</strong>
              </span>
              <span className="font-bold text-white font-mono">
                Net: {formatINR2(netAmount)}
              </span>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm text-slate-300 hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 rounded-lg text-sm font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow"
            >
              {saving
                ? 'Saving...'
                : editingTrade
                ? 'Update Trade'
                : `Save ${action} Trade`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};