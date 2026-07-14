import { api } from '@/lib/services/http';
import { useAdminNutritionStore } from '@/lib/stores/adminNutritionStore';
import { useAdminPackageStore } from '@/lib/stores/adminPackageStore';

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

// ── includes_nutrition per plan (adminPackageStore) ─────────────────────────

const PACKAGE = {
  id: 101,
  title: 'Plan Base',
  short_description: '',
  description: '',
  category: 'personalizado' as const,
  sessions_count: 8,
  session_duration_minutes: 60,
  price: '300000',
  currency: 'COP',
  includes_nutrition: false,
  validity_days: 30,
  terms_and_conditions: '',
  is_active: true,
  order: 1,
  created_at: '2026-06-01T10:00:00Z',
  updated_at: '2026-06-01T10:00:00Z',
};

test('toggleNutrition patches the package and keeps the new value', async () => {
  useAdminPackageStore.setState({ packages: [PACKAGE] });
  mockApi.patch.mockResolvedValue({ data: { ...PACKAGE, includes_nutrition: true } });

  const ok = await useAdminPackageStore.getState().toggleNutrition(101, true);

  expect(ok).toBe(true);
  expect(mockApi.patch).toHaveBeenCalledWith(
    '/packages/101/',
    { includes_nutrition: true },
    expect.anything(),
  );
  expect(useAdminPackageStore.getState().packages[0].includes_nutrition).toBe(true);
});

test('toggleNutrition rolls back when the request fails', async () => {
  useAdminPackageStore.setState({ packages: [PACKAGE] });
  mockApi.patch.mockRejectedValue(new Error('boom'));

  const ok = await useAdminPackageStore.getState().toggleNutrition(101, true);

  expect(ok).toBe(false);
  expect(useAdminPackageStore.getState().packages[0].includes_nutrition).toBe(false);
});
