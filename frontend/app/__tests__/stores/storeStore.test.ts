jest.mock('js-cookie', () => ({ get: jest.fn(() => 'tok'), set: jest.fn(), remove: jest.fn() }));
jest.mock('@/lib/services/http', () => ({
  api: { get: jest.fn(), post: jest.fn(), patch: jest.fn(), delete: jest.fn(), put: jest.fn() },
  getWithRetry: jest.fn(),
  extractApiError: jest.fn((e: { response?: { data?: { detail?: string } } }, fb: string) => e?.response?.data?.detail ?? fb),
}));

import { api } from '@/lib/services/http';
import { useStoreStore } from '@/lib/stores/storeStore';

describe('storeStore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useStoreStore.setState({ items: [], balance: 0, pendingBalance: 0, redemptions: [], pendingReviews: [], loading: false, error: '' });
  });

  it('fetchCatalog stores items and balances', async () => {
    (api.get as jest.Mock).mockResolvedValue({ data: { items: [{ id: 1, name: 'X', price_credits: 50 }], balance: 100, pending_balance: 15 } });
    await useStoreStore.getState().fetchCatalog();
    const s = useStoreStore.getState();
    expect(s.items).toHaveLength(1);
    expect(s.balance).toBe(100);
    expect(s.pendingBalance).toBe(15);
  });

  it('redeem posts item_id and returns true on success', async () => {
    (api.post as jest.Mock).mockResolvedValue({ data: { id: 9, status: 'pending' } });
    (api.get as jest.Mock).mockResolvedValue({ data: { items: [], balance: 40, pending_balance: 0 } });
    const ok = await useStoreStore.getState().redeem(1);
    expect(api.post).toHaveBeenCalledWith('/store/redemptions/', { item_id: 1 }, expect.any(Object));
    expect(ok).toBe(true);
  });

  it('redeem returns false and sets error on insufficient funds', async () => {
    (api.post as jest.Mock).mockRejectedValue({ response: { data: { detail: 'No tienes créditos suficientes para este canje.' } } });
    const ok = await useStoreStore.getState().redeem(1);
    expect(ok).toBe(false);
    expect(useStoreStore.getState().error).toBe('No tienes créditos suficientes para este canje.');
  });
});
