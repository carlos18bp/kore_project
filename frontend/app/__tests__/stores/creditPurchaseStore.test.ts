jest.mock('js-cookie', () => ({ get: jest.fn(() => 'tok'), set: jest.fn(), remove: jest.fn() }));
jest.mock('@/lib/services/http', () => ({
  api: { get: jest.fn(), post: jest.fn() },
  extractApiError: jest.fn((_e: unknown, fb: string) => fb),
}));

import { api } from '@/lib/services/http';
import { useCreditPurchaseStore } from '@/lib/stores/creditPurchaseStore';

describe('creditPurchaseStore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useCreditPurchaseStore.setState({ packages: [] });
  });

  it('fetchCreditPackages stores packages', async () => {
    (api.get as jest.Mock).mockResolvedValue({ data: [{ id: 1, name: 'A', credits: 100, price_cop: 20000 }] });
    await useCreditPurchaseStore.getState().fetchCreditPackages();
    expect(useCreditPurchaseStore.getState().packages).toHaveLength(1);
  });

  it('startCreditPurchase posts the package id and returns checkout_url', async () => {
    (api.post as jest.Mock).mockResolvedValue({ data: { reference: 'CR-x', checkout_url: 'https://checkout.wompi.co/p/?x' } });
    const url = await useCreditPurchaseStore.getState().startCreditPurchase(1);
    expect(api.post).toHaveBeenCalledWith('/credits/purchases/', { credit_package_id: 1 }, expect.any(Object));
    expect(url).toBe('https://checkout.wompi.co/p/?x');
  });
});
