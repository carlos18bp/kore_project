import { api } from '@/lib/services/http';
import { useAdminNutritionStore } from '@/lib/stores/adminNutritionStore';

jest.mock('@/lib/services/http', () => ({
  api: { get: jest.fn(), patch: jest.fn() },
  // The store calls this in its catch block; without it the rejection path throws.
  extractApiError: (_err: unknown, fallback: string) => fallback,
}));
jest.mock('js-cookie', () => ({ get: jest.fn(() => 'token') }));

const mockApi = api as unknown as { get: jest.Mock; patch: jest.Mock };

const PRODUCT = {
  id: 1,
  name: 'Nutrición',
  price_cop: 30000,
  is_active: true,
  active_nutrition_subscriptions: 7,
};

beforeEach(() => {
  jest.clearAllMocks();
  useAdminNutritionStore.setState({
    product: null,
    activeSubscriptions: 0,
    loading: false,
    actionLoading: false,
    error: '',
  });
});

test('fetchProduct stores the product and the impact count', async () => {
  mockApi.get.mockResolvedValue({ data: PRODUCT });

  await useAdminNutritionStore.getState().fetchProduct();

  const state = useAdminNutritionStore.getState();
  expect(mockApi.get).toHaveBeenCalledWith('/admin/nutrition-product/', expect.anything());
  expect(state.product?.price_cop).toBe(30000);
  expect(state.activeSubscriptions).toBe(7);
  expect(state.loading).toBe(false);
});

test('updateProduct patches the price and refreshes the state', async () => {
  useAdminNutritionStore.setState({ product: PRODUCT, activeSubscriptions: 7 });
  mockApi.patch.mockResolvedValue({
    data: { ...PRODUCT, price_cop: 45000, active_nutrition_subscriptions: 7 },
  });

  const ok = await useAdminNutritionStore.getState().updateProduct({
    price_cop: 45000,
    is_active: true,
  });

  expect(ok).toBe(true);
  expect(mockApi.patch).toHaveBeenCalledWith(
    '/admin/nutrition-product/',
    { price_cop: 45000, is_active: true },
    expect.anything(),
  );
  expect(useAdminNutritionStore.getState().product?.price_cop).toBe(45000);
});

test('updateProduct surfaces an error and returns false on failure', async () => {
  useAdminNutritionStore.setState({ product: PRODUCT });
  mockApi.patch.mockRejectedValue(new Error('boom'));

  const ok = await useAdminNutritionStore.getState().updateProduct({
    price_cop: 45000,
    is_active: true,
  });

  expect(ok).toBe(false);
  expect(useAdminNutritionStore.getState().error).not.toBe('');
  expect(useAdminNutritionStore.getState().actionLoading).toBe(false);
});
