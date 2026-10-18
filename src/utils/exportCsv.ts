import { TickerPositionSummary, TradeDocument } from '../types/ledger';

function downloadCsvFile(filename: string, csvContent: string) {
  // Add UTF-8 BOM so Microsoft Excel opens ₹ symbols and numbers cleanly
  const blob = new Blob(['\uFEFF' + csvContent], {
    type: 'text/csv;charset=utf-8;',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function exportHoldingsToCsv(summaries: TickerPositionSummary[]) {
  const headers = [
    'Ticker',
    'Exchange',
    'Category',
    'Open Qty',
    'FIFO Avg Buy (INR)',
    'Net Invested (INR)',
    'Latest EOD Price (INR)',
    'Current Value (INR)',
    'Unrealized Gross P&L (INR)',
    'Unrealized Net P&L (INR)',
    'Unrealized P&L (%)',
    'Realized Gross P&L (INR)',
    'Realized Net P&L (INR)',
    'Total Groww Charges (INR)',
    'Stock XIRR (%)',
    'Nifty 50 Shadow XIRR (%)',
  ];

  const rows = summaries.map((s) => [
    s.ticker,
    s.exchange,
    s.assetCategory,
    s.openQty,
    s.avgBuyPrice.toFixed(2),
    s.netInvestedValue.toFixed(2),
    s.latestPrice.toFixed(2),
    s.currentValue.toFixed(2),
    s.unrealizedGrossPnl.toFixed(2),
    s.unrealizedNetPnl.toFixed(2),
    s.unrealizedPnlPct.toFixed(2),
    s.realizedGrossPnl.toFixed(2),
    s.realizedNetPnl.toFixed(2),
    s.totalChargesPaid.toFixed(2),
    s.xirr !== null ? (s.xirr * 100).toFixed(2) : '',
    s.benchmarkXirr !== null ? (s.benchmarkXirr * 100).toFixed(2) : '',
  ]);

  const csvContent = [
    headers.join(','),
    ...rows.map((r) => r.map((cell) => `"${cell}"`).join(',')),
  ].join('\n');

  const today = new Date().toISOString().split('T')[0];
  downloadCsvFile(`IND_StockPulse_Holdings_${today}.csv`, csvContent);
}

export function exportTradesToCsv(trades: TradeDocument[]) {
  const headers = [
    'Trade Date',
    'Ticker',
    'Exchange',
    'Category',
    'Trade Mode',
    'Action',
    'Quantity',
    'Price (INR)',
    'Gross Amount (INR)',
    'Brokerage (INR)',
    'STT (INR)',
    'DP Charges (INR)',
    'Stamp Duty (INR)',
    'Exch+SEBI (INR)',
    'GST (INR)',
    'Total Charges (INR)',
    'Net Cash Flow (INR)',
    'Strategy Tag',
  ];

  const rows = trades.map((t) => [
    t.tradeDate,
    t.ticker,
    t.exchange,
    t.assetCategory,
    t.tradeType,
    t.action,
    t.quantity,
    t.price.toFixed(2),
    t.grossAmount.toFixed(2),
    t.charges.brokerage.toFixed(2),
    t.charges.stt.toFixed(2),
    t.charges.dpCharges.toFixed(2),
    t.charges.stampDuty.toFixed(2),
    (t.charges.exchangeTxnCharge + t.charges.sebiCharges).toFixed(2),
    t.charges.gst.toFixed(2),
    t.charges.totalCharges.toFixed(2),
    t.netAmount.toFixed(2),
    (t.strategyTag || '').replace(/"/g, '""'),
  ]);

  const csvContent = [
    headers.join(','),
    ...rows.map((r) => r.map((cell) => `"${cell}"`).join(',')),
  ].join('\n');

  const today = new Date().toISOString().split('T')[0];
  downloadCsvFile(`IND_StockPulse_Tradebook_${today}.csv`, csvContent);
}