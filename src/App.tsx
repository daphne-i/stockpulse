import React, { useEffect, useMemo, useState } from 'react';
import { BarChart3, Download, LineChart, Plus, TableProperties } from 'lucide-react';
import { MarketDataDocument, TradeDocument } from './types/ledger';
import {
  deleteTradeFromFirestore,
  saveTradeToFirestore,
  subscribeToMarketData,
  subscribeToTrades,
} from './lib/firebase';
import { buildPortfolioOverview } from './utils/portfolioAggregator';
import { exportTradesToCsv } from './utils/exportCsv';
import { KpiScorecards } from './components/KpiScorecards';
import { XirrBenchmarkChart } from './components/XirrBenchmarkChart';
import { GrossToNetWaterfall } from './components/GrossToNetWaterfall';
import { HoldingsTable } from './components/HoldingsTable';
import { StockDeepDiveView } from './components/StockDeepDiveView';
import { TradeEntryModal } from './components/TradeEntryModal';

type DashboardTab = 'HOLDINGS' | 'ANALYTICS';

export function App() {
  const [trades, setTrades] = useState<TradeDocument[]>([]);
  const [marketMap, setMarketMap] = useState<Record<string, MarketDataDocument>>({});
  const [selectedTicker, setSelectedTicker] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<DashboardTab>('HOLDINGS');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalDefaultTicker, setModalDefaultTicker] = useState('');
  const [editingTrade, setEditingTrade] = useState<TradeDocument | null>(null);

  useEffect(() => {
    const unsubTrades = subscribeToTrades(
      (liveTrades) => setTrades(liveTrades),
      () => {}
    );

    const unsubMarket = subscribeToMarketData((liveMarket) => {
      setMarketMap((prev) => ({ ...prev, ...liveMarket }));
    });

    return () => {
      unsubTrades();
      unsubMarket();
    };
  }, []);

  const portfolioMetrics = useMemo(
    () => buildPortfolioOverview(trades, marketMap),
    [trades, marketMap]
  );

  const handleSaveTrade = async (savedTrade: TradeDocument) => {
    // Update local state optimistically (either replace edited trade or prepend new trade)
    setTrades((prev) => {
      const exists = prev.some((t) => t.id === savedTrade.id);
      if (exists) {
        return prev.map((t) => (t.id === savedTrade.id ? savedTrade : t));
      }
      return [savedTrade, ...prev];
    });
    await saveTradeToFirestore(savedTrade);
  };

  const handleDeleteTrade = async (tradeId: string) => {
    setTrades((prev) => prev.filter((t) => t.id !== tradeId));
    await deleteTradeFromFirestore(tradeId);
  };

  const handleOpenEditModal = (trade: TradeDocument) => {
    setEditingTrade(trade);
    setModalDefaultTicker(trade.ticker);
    setIsModalOpen(true);
  };

  const handleEditHoldingFromTable = (ticker: string) => {
    const tickerTrades = trades
      .filter((t) => t.ticker === ticker)
      .sort((a, b) => b.tradeDate.localeCompare(a.tradeDate));

    // If the holding has trades, open the modal pre-loaded with its latest trade (or open Deep-Dive if multiple)
    if (tickerTrades.length === 1) {
      handleOpenEditModal(tickerTrades[0]);
    } else if (tickerTrades.length > 1) {
      setSelectedTicker(ticker);
    }
  };

  const selectedSummary = useMemo(
    () =>
      portfolioMetrics.tickerSummaries.find(
        (s) => s.ticker === selectedTicker
      ) || null,
    [portfolioMetrics, selectedTicker]
  );

  const selectedTickerTrades = useMemo(
    () =>
      trades
        .filter((t) => t.ticker === selectedTicker)
        .sort((a, b) => b.tradeDate.localeCompare(a.tradeDate)),
    [trades, selectedTicker]
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* Top Navigation Header */}
      <header className="border-b border-slate-800 bg-slate-900/90 backdrop-blur sticky top-0 z-30">
        <div className="max-w-[1440px] mx-auto px-6 py-3.5 flex flex-wrap items-center justify-between gap-4">
          <div
            onClick={() => setSelectedTicker(null)}
            className="flex items-center gap-3 cursor-pointer"
          >
            <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center shadow-md shadow-indigo-600/20">
              <BarChart3 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-white">
                IND-StockPulse
              </h1>
              <p className="text-xs text-slate-400">
                FIFO Tax Ledger • Groww Friction Bridge • True XIRR
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => exportTradesToCsv(trades)}
              disabled={trades.length === 0}
              className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-xs font-medium text-slate-200 border border-slate-700 transition"
              title="Export all buy/sell transactions to CSV"
            >
              <Download className="w-4 h-4 text-indigo-400" />
              Export Tradebook CSV
            </button>

            <button
              onClick={() => {
                setEditingTrade(null);
                setModalDefaultTicker(selectedTicker || '');
                setIsModalOpen(true);
              }}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-sm font-semibold text-white shadow transition"
            >
              <Plus className="w-4 h-4" />
              Log Buy / Sell
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-[1440px] mx-auto px-6 py-5">
        {selectedTicker && selectedSummary ? (
          <StockDeepDiveView
            summary={selectedSummary}
            trades={selectedTickerTrades}
            marketData={marketMap[selectedTicker]}
            onBack={() => setSelectedTicker(null)}
            onOpenAddTradeForTicker={(tk) => {
              setEditingTrade(null);
              setModalDefaultTicker(tk);
              setIsModalOpen(true);
            }}
            onEditTrade={handleOpenEditModal}
            onDeleteTrade={handleDeleteTrade}
          />
        ) : (
          <div className="space-y-5">
            {/* Pinned Top 5 Portfolio KPI Cards */}
            <KpiScorecards metrics={portfolioMetrics} />

            {/* Two-Tab Navigation Bar */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="inline-flex p-1 rounded-xl bg-slate-900 border border-slate-800">
                <button
                  onClick={() => setActiveTab('HOLDINGS')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition ${
                    activeTab === 'HOLDINGS'
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <TableProperties className="w-4 h-4" />
                  Portfolio Holdings & Ticker Ledger ({portfolioMetrics.tickerSummaries.length})
                </button>

                <button
                  onClick={() => setActiveTab('ANALYTICS')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition ${
                    activeTab === 'ANALYTICS'
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <LineChart className="w-4 h-4" />
                  XIRR & Groww Friction Graphs
                </button>
              </div>

              <span className="text-xs text-slate-400 hidden sm:inline">
                {activeTab === 'HOLDINGS'
                  ? 'Click any stock row to open its EOD Price + Buy/Sell Triangle Deep-Dive'
                  : 'Comparing cash-flow returns against Nifty 50 and statutory fee deductions'}
              </span>
            </div>

            {/* Tab 1: Portfolio Holdings & Ticker Ledger Summary */}
            {activeTab === 'HOLDINGS' && (
              <HoldingsTable
                summaries={portfolioMetrics.tickerSummaries}
                onSelectTicker={(tk) => setSelectedTicker(tk)}
                onEditHoldingTrades={handleEditHoldingFromTable}
              />
            )}

            {/* Tab 2: Both Graphs Side-by-Side */}
            {activeTab === 'ANALYTICS' && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                <div className="lg:col-span-7">
                  <XirrBenchmarkChart metrics={portfolioMetrics} />
                </div>
                <div className="lg:col-span-5">
                  <GrossToNetWaterfall
                    grossTotalPnl={
                      portfolioMetrics.realizedGrossPnl +
                      portfolioMetrics.unrealizedGrossPnl
                    }
                    netTotalPnl={
                      portfolioMetrics.realizedNetPnl +
                      portfolioMetrics.unrealizedNetPnl
                    }
                    charges={portfolioMetrics.chargesBreakdown}
                  />
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Add / Edit Trade Modal */}
      <TradeEntryModal
        isOpen={isModalOpen}
        defaultTicker={modalDefaultTicker}
        editingTrade={editingTrade}
        existingTrades={trades}
        onClose={() => {
          setIsModalOpen(false);
          setEditingTrade(null);
        }}
        onSaveTrade={handleSaveTrade}
      />
    </div>
  );
}

export default App;