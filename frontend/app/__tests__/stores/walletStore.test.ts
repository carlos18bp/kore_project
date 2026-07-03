jest.mock('js-cookie', () => ({ get: jest.fn(() => 'tok'), set: jest.fn(), remove: jest.fn() }));
jest.mock('@/lib/services/http', () => ({
  api: { get: jest.fn(), post: jest.fn(), patch: jest.fn(), delete: jest.fn() },
  getWithRetry: jest.fn(),
  extractApiError: jest.fn((_e: unknown, fb: string) => fb),
}));

import { api } from '@/lib/services/http';
import { useWalletStore } from '@/lib/stores/walletStore';

const WALLET = {
  balance: 55, pending_balance: 15, current_streak: 3, longest_streak: 9,
  last_active_date: '2026-07-03', next_milestone: { days: 7, bonus: 50, remaining: 4 },
};
const tx = (id: number) => ({
  id, action: 'checkin', amount: 5, status: 'confirmed', description: `Check-in ${id}`,
  reference_type: 'mood_entry', reference_id: `${id}`, review_deadline: null, created_at: '2026-07-03T10:00:00Z',
});

describe('walletStore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useWalletStore.setState({ wallet: null, transactions: [], txCount: 0, walletLoaded: false, txLoading: false, error: '' });
  });

  it('fetchWallet loads once, force refetches', async () => {
    (api.get as jest.Mock).mockResolvedValue({ data: WALLET });
    await useWalletStore.getState().fetchWallet();
    expect(useWalletStore.getState().wallet?.balance).toBe(55);
    expect(useWalletStore.getState().walletLoaded).toBe(true);
    await useWalletStore.getState().fetchWallet();       // no-op
    expect(api.get).toHaveBeenCalledTimes(1);
    await useWalletStore.getState().fetchWallet(true);    // forced
    expect(api.get).toHaveBeenCalledTimes(2);
  });

  it('fetchTransactions appends pages and stops at count', async () => {
    (api.get as jest.Mock).mockResolvedValueOnce({ data: { count: 3, results: [tx(1), tx(2)] } });
    await useWalletStore.getState().fetchTransactions(true);
    expect(useWalletStore.getState().transactions).toHaveLength(2);
    expect(api.get).toHaveBeenLastCalledWith('/credits/transactions/', expect.objectContaining({ params: { limit: 20, offset: 0 } }));

    (api.get as jest.Mock).mockResolvedValueOnce({ data: { count: 3, results: [tx(3)] } });
    await useWalletStore.getState().fetchTransactions();
    expect(useWalletStore.getState().transactions).toHaveLength(3);
    expect(api.get).toHaveBeenLastCalledWith('/credits/transactions/', expect.objectContaining({ params: { limit: 20, offset: 2 } }));

    // all loaded → no further request
    const calls = (api.get as jest.Mock).mock.calls.length;
    await useWalletStore.getState().fetchTransactions();
    expect((api.get as jest.Mock).mock.calls.length).toBe(calls);
  });
});
