import { create } from 'zustand';
import Cookies from 'js-cookie';
import { api } from '@/lib/services/http';

export type WalletData = {
  balance: number;
  pending_balance: number;
  current_streak: number;
  longest_streak: number;
  last_active_date: string | null;
  next_milestone: { days: number; bonus: number; remaining: number } | null;
};

export type CreditTransaction = {
  id: number;
  action: string;
  amount: number;
  status: 'pending' | 'confirmed' | 'rejected';
  description: string;
  reference_type: string;
  reference_id: string | null;
  review_deadline: string | null;
  created_at: string;
};

type WalletState = {
  wallet: WalletData | null;
  transactions: CreditTransaction[];
  txCount: number;
  walletLoaded: boolean;
  txLoading: boolean;
  error: string;
  fetchWallet: (force?: boolean) => Promise<void>;
  fetchTransactions: (reset?: boolean) => Promise<void>;
};

const PAGE = 20;

function authHeaders() {
  const token = Cookies.get('kore_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export const useWalletStore = create<WalletState>((set, get) => ({
  wallet: null,
  transactions: [],
  txCount: 0,
  walletLoaded: false,
  txLoading: false,
  error: '',

  fetchWallet: async (force = false) => {
    if (get().walletLoaded && !force) return;
    try {
      const { data } = await api.get('/credits/wallet/', { headers: authHeaders() });
      set({ wallet: data, walletLoaded: true, error: '' });
    } catch {
      set({ error: 'No se pudo cargar tu balance de créditos.' });
    }
  },

  fetchTransactions: async (reset = false) => {
    const state = get();
    if (state.txLoading) return;
    const offset = reset ? 0 : state.transactions.length;
    // Stop when everything is already loaded (not a reset).
    if (!reset && state.txCount > 0 && offset >= state.txCount) return;
    set({ txLoading: true });
    try {
      const { data } = await api.get('/credits/transactions/', {
        headers: authHeaders(),
        params: { limit: PAGE, offset },
      });
      set((s) => ({
        transactions: reset ? data.results : [...s.transactions, ...data.results],
        txCount: data.count,
        txLoading: false,
      }));
    } catch {
      set({ txLoading: false, error: 'No se pudo cargar tu historial.' });
    }
  },
}));
