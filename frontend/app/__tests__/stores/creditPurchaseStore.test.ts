jest.mock('js-cookie', () => ({ get: jest.fn(() => 'tok'), set: jest.fn(), remove: jest.fn() }));
jest.mock('@/lib/services/http', () => ({
  api: { get: jest.fn(), post: jest.fn() },
  extractApiError: jest.fn((_e: unknown, fb: string) => fb),
}));

import { api } from '@/lib/services/http';
import { useCreditPurchaseStore } from '@/lib/stores/creditPurchaseStore';

import Cookies from 'js-cookie';

describe('creditPurchaseStore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (Cookies.get as jest.Mock).mockReturnValue('tok');
    useCreditPurchaseStore.setState({ packages: [], loading: false, error: '' });
  });

  it('fetchCreditPackages stores packages', async () => {
    (api.get as jest.Mock).mockResolvedValue({ data: [{ id: 1, name: 'A', credits: 100, price_cop: 20000 }] });
    await useCreditPurchaseStore.getState().fetchCreditPackages();
    expect(useCreditPurchaseStore.getState().packages).toHaveLength(1);
  });

  it('fetchCreditPackages sets the Spanish error and stops loading on failure', async () => {
    (api.get as jest.Mock).mockRejectedValue(new Error('network'));
    await useCreditPurchaseStore.getState().fetchCreditPackages();
    expect(useCreditPurchaseStore.getState().error).toBe('No se pudieron cargar los paquetes.');
    expect(useCreditPurchaseStore.getState().loading).toBe(false);
  });

  it('fetchCreditPackages normalizes a non-array payload to an empty list', async () => {
    (api.get as jest.Mock).mockResolvedValue({ data: { detail: 'unexpected' } });
    await useCreditPurchaseStore.getState().fetchCreditPackages();
    expect(useCreditPurchaseStore.getState().packages).toEqual([]);
  });

  it('startCreditPurchase posts the package id and returns checkout_url', async () => {
    (api.post as jest.Mock).mockResolvedValue({ data: { reference: 'CR-x', checkout_url: 'https://checkout.wompi.co/p/?x' } });
    const url = await useCreditPurchaseStore.getState().startCreditPurchase(1);
    expect(api.post).toHaveBeenCalledWith('/credits/purchases/', { credit_package_id: 1 }, expect.any(Object));
    expect(url).toBe('https://checkout.wompi.co/p/?x');
  });

  it('startCreditPurchase returns null and sets the error on failure', async () => {
    (api.post as jest.Mock).mockRejectedValue(new Error('declined'));
    const url = await useCreditPurchaseStore.getState().startCreditPurchase(1);
    expect(url).toBeNull();
    expect(useCreditPurchaseStore.getState().error).toBe('No se pudo iniciar la compra.');
  });

  it('fetchPurchaseStatus returns the purchase payload', async () => {
    (api.get as jest.Mock).mockResolvedValue({ data: { reference: 'CR-x', status: 'approved', credits: 100 } });
    const result = await useCreditPurchaseStore.getState().fetchPurchaseStatus('CR-x');
    expect(api.get).toHaveBeenCalledWith('/credits/purchases/CR-x/', expect.any(Object));
    expect(result).toEqual({ reference: 'CR-x', status: 'approved', credits: 100 });
  });

  it('fetchPurchaseStatus returns null when the request fails', async () => {
    (api.get as jest.Mock).mockRejectedValue(new Error('404'));
    const result = await useCreditPurchaseStore.getState().fetchPurchaseStatus('CR-missing');
    expect(result).toBeNull();
  });

  it('sends requests without Authorization header when the token cookie is absent', async () => {
    (Cookies.get as jest.Mock).mockReturnValue(undefined);
    (api.get as jest.Mock).mockResolvedValue({ data: [] });
    await useCreditPurchaseStore.getState().fetchCreditPackages();
    expect(api.get).toHaveBeenCalledWith('/credits/packages/', { headers: {} });
  });
});
