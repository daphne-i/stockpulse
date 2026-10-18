import os
import json
from datetime import datetime, timedelta, timezone
import yfinance as yf
import firebase_admin
from firebase_admin import credentials, firestore

IST = timezone(timedelta(hours=5, minutes=30))

# Common company name aliases -> Official NSE Ticker mapping
TICKER_ALIASES = {
    "HDFC": "HDFCBANK",
    "HDFC BANK": "HDFCBANK",
    "TATA CONSULTANCY": "TCS",
    "RELIANCE IND": "RELIANCE",
    "ICICI": "ICICIBANK",
    "ICICI BANK": "ICICIBANK",
    "KOTAK": "KOTAKBANK",
    "SBI": "SBIN",
    "INFOSYS": "INFY",
}

def init_firestore():
    """Initializes Firebase Admin using GitHub Secret FIREBASE_SERVICE_ACCOUNT."""
    sa_json = os.environ.get("FIREBASE_SERVICE_ACCOUNT")
    if not sa_json:
        raise ValueError("Missing FIREBASE_SERVICE_ACCOUNT environment variable.")
    cred_dict = json.loads(sa_json)
    cred = credentials.Certificate(cred_dict)
    firebase_admin.initialize_app(cred)
    return firestore.client()

def fetch_and_sync():
    db = init_firestore()
    now_ist = datetime.now(IST)
    print(f"[{now_ist.isoformat()}] Starting IND-StockPulse EOD Sync...")

    # Always pull at least 1 year of history so charts look complete even for brand-new/weekend trades
    one_year_ago = (now_ist - timedelta(days=365)).strftime("%Y-%m-%d")
    five_years_ago = (now_ist - timedelta(days=365 * 5)).strftime("%Y-%m-%d")

    trades_ref = db.collection("trades").stream()
    ticker_meta = {}
    earliest_global_date = one_year_ago
    trade_docs_count = 0

    for doc in trades_ref:
        trade_docs_count += 1
        data = doc.to_dict()
        raw_ticker = data.get("ticker", "").strip().upper()
        exchange = data.get("exchange", "NSE").strip().upper()
        t_date = data.get("tradeDate", one_year_ago)

        if not raw_ticker:
            continue

        # Clamp earliest date to 5 years max so Firestore docs stay lightweight
        effective_start = min(t_date, one_year_ago)
        effective_start = max(effective_start, five_years_ago)

        if effective_start < earliest_global_date:
            earliest_global_date = effective_start

        clean_symbol = TICKER_ALIASES.get(raw_ticker, raw_ticker.replace(" ", ""))
        suffix = ".NS" if exchange == "NSE" else ".BO"

        if raw_ticker not in ticker_meta:
            ticker_meta[raw_ticker] = {
                "yahooSymbol": f"{clean_symbol}{suffix}",
                "earliestDate": effective_start
            }
        else:
            if effective_start < ticker_meta[raw_ticker]["earliestDate"]:
                ticker_meta[raw_ticker]["earliestDate"] = effective_start

    print(f"Found {trade_docs_count} trade documents across {len(ticker_meta)} unique stock tickers: {list(ticker_meta.keys())}")

    # Always include Nifty 50 Benchmark (^NSEI) stored under document ID 'NIFTY50'
    ticker_meta["NIFTY50"] = {
        "yahooSymbol": "^NSEI",
        "earliestDate": earliest_global_date
    }

    batch = db.batch()
    synced_count = 0

    for ticker, meta in ticker_meta.items():
        y_sym = meta["yahooSymbol"]
        start_date = meta["earliestDate"]
        print(f"--> Fetching {ticker} (Yahoo symbol: {y_sym}) from {start_date}...")

        try:
            tk = yf.Ticker(y_sym)
            df = tk.history(start=start_date, interval="1d", auto_adjust=True)

            # Fallback: if .NS returned empty, try .BO or 1-year period
            if df.empty and y_sym.endswith(".NS"):
                alt_sym = y_sym.replace(".NS", ".BO")
                print(f"    No data for {y_sym}, retrying with {alt_sym}...")
                tk = yf.Ticker(alt_sym)
                df = tk.history(period="1y", interval="1d", auto_adjust=True)
                if not df.empty:
                    y_sym = alt_sym

            if df.empty:
                print(f"    WARNING: Yahoo Finance returned empty data for {ticker} ({y_sym}). Check if ticker symbol is valid on NSE/BSE.")
                continue

            history = []
            for idx, row in df.iterrows():
                close_val = row.get("Close")
                if close_val is not None and str(close_val) != "nan":
                    history.append({
                        "date": idx.strftime("%Y-%m-%d"),
                        "close": round(float(close_val), 2)
                    })

            if not history:
                print(f"    WARNING: No valid closing prices parsed for {ticker}")
                continue

            latest_close = history[-1]["close"]
            prev_close = history[-2]["close"] if len(history) > 1 else latest_close
            day_change = round(latest_close - prev_close, 2)
            day_change_pct = round((day_change / prev_close) * 100, 2) if prev_close > 0 else 0.0

            doc_ref = db.collection("market_data").document(ticker)
            batch.set(doc_ref, {
                "ticker": ticker,
                "yahooSymbol": y_sym,
                "companyName": ticker if ticker != "NIFTY50" else "Nifty 50 Index",
                "latestPrice": latest_close,
                "previousClose": prev_close,
                "dayChange": day_change,
                "dayChangePct": day_change_pct,
                "lastTradeDate": history[-1]["date"],
                "updatedAt": now_ist.isoformat(),
                "history": history
            })
            synced_count += 1
            print(f"    SUCCESS: {ticker} latest close = ₹{latest_close} ({len(history)} days stored)")

        except Exception as e:
            print(f"    ERROR syncing {ticker}: {e}")

    status_ref = db.collection("sync_metadata").document("status")
    batch.set(status_ref, {
        "lastRunAt": now_ist.isoformat(),
        "tickersSynced": synced_count,
        "status": "SUCCESS"
    })

    batch.commit()
    print(f"Successfully synced {synced_count} symbols to Firestore.")

if __name__ == "__main__":
    fetch_and_sync()