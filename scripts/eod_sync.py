import os
import json
from datetime import datetime, timedelta, timezone
import yfinance as yf
import firebase_admin
from firebase_admin import credentials, firestore

IST = timezone(timedelta(hours=5, minutes=30))

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

    # 1. Read all distinct tickers + earliest trade date from 'trades' collection
    trades_ref = db.collection("trades").stream()
    ticker_meta = {}
    earliest_global_date = "2023-01-01"

    for doc in trades_ref:
        data = doc.to_dict()
        ticker = data.get("ticker", "").strip().upper()
        exchange = data.get("exchange", "NSE").strip().upper()
        t_date = data.get("tradeDate", "2023-01-01")

        if not ticker:
            continue

        if t_date < earliest_global_date:
            earliest_global_date = t_date

        if ticker not in ticker_meta:
            suffix = ".NS" if exchange == "NSE" else ".BO"
            ticker_meta[ticker] = {
                "yahooSymbol": f"{ticker}{suffix}",
                "earliestDate": t_date
            }
        else:
            if t_date < ticker_meta[ticker]["earliestDate"]:
                ticker_meta[ticker]["earliestDate"] = t_date

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
        print(f"Fetching {ticker} ({y_sym}) from {start_date}...")

        try:
            tk = yf.Ticker(y_sym)
            df = tk.history(start=start_date, interval="1d", auto_adjust=True)

            if df.empty:
                print(f"Warning: No data returned for {y_sym}")
                continue

            # Build compact history array
            history = []
            for idx, row in df.iterrows():
                history.append({
                    "date": idx.strftime("%Y-%m-%d"),
                    "close": round(float(row["Close"]), 2)
                })

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

        except Exception as e:
            print(f"Error syncing {ticker}: {e}")

    # Update sync_metadata/status document
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