jest.mock('js-cookie', () => ({ get: jest.fn(() => 'tok'), set: jest.fn(), remove: jest.fn() }));
jest.mock('@/lib/services/http', () => ({ api: { get: jest.fn(), post: jest.fn() } }));

import { api } from '@/lib/services/http';
import { useNutritionUpgradeStore } from '@/lib/stores/nutritionUpgradeStore';

describe('nutritionUpgradeStore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useNutritionUpgradeStore.setState({ access: false, price: null });
  });

  it('fetchNutritionAccess stores access + price', async () => {
    (api.get as jest.Mock).mockResolvedValue({ data: { has_nutrition_access: true, price_cop: 30000 } });
    await useNutritionUpgradeStore.getState().fetchNutritionAccess();
    expect(useNutritionUpgradeStore.getState().access).toBe(true);
    expect(useNutritionUpgradeStore.getState().price).toBe(30000);
  });

  it('startNutritionUpgrade returns checkout_url', async () => {
    (api.post as jest.Mock).mockResolvedValue({ data: { reference: 'NU-x', checkout_url: 'https://checkout.wompi.co/p/?x', amount_cop: 15000 } });
    const url = await useNutritionUpgradeStore.getState().startNutritionUpgrade();
    expect(url).toBe('https://checkout.wompi.co/p/?x');
  });
});
