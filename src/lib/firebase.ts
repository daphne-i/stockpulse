import { initializeApp } from 'firebase/app';
import {
  collection,
  deleteDoc,
  doc,
  getFirestore,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  QuerySnapshot,
  QueryDocumentSnapshot,
  DocumentData,
  FirestoreError,
} from 'firebase/firestore';
import { MarketDataDocument, TradeDocument } from '../types/ledger';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'DEMO_KEY',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'demo.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'demo-project',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'demo.appspot.com',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '000000',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:000:web:000',
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

export async function saveTradeToFirestore(trade: TradeDocument): Promise<void> {
  const ref = doc(db, 'trades', trade.id);
  await setDoc(ref, trade);
}

export async function deleteTradeFromFirestore(tradeId: string): Promise<void> {
  const ref = doc(db, 'trades', tradeId);
  await deleteDoc(ref);
}

export function subscribeToTrades(
  callback: (trades: TradeDocument[]) => void,
  onError?: (err: Error) => void
) {
  const q = query(collection(db, 'trades'), orderBy('tradeDate', 'desc'));
  return onSnapshot(
    q,
    (snapshot: QuerySnapshot<DocumentData>) => {
      const items: TradeDocument[] = [];
      snapshot.forEach((docSnap: QueryDocumentSnapshot<DocumentData>) => {
        items.push(docSnap.data() as TradeDocument);
      });
      callback(items);
    },
    (err: FirestoreError) => onError?.(err)
  );
}

export function subscribeToMarketData(
  callback: (marketMap: Record<string, MarketDataDocument>) => void
) {
  const q = collection(db, 'market_data');
  return onSnapshot(q, (snapshot: QuerySnapshot<DocumentData>) => {
    const map: Record<string, MarketDataDocument> = {};
    snapshot.forEach((docSnap: QueryDocumentSnapshot<DocumentData>) => {
      const data = docSnap.data() as MarketDataDocument;
      map[data.ticker] = data;
    });
    callback(map);
  });
}