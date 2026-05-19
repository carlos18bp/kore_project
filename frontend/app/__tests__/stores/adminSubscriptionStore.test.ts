import Cookies from 'js-cookie';
import { useAdminSubscriptionStore } from '@/lib/stores/adminSubscriptionStore';
import type { AdminSubscription } from '@/lib/stores/adminSubscriptionStore';
import { api } from '@/lib/services/http';

jest.mock('js-cookie', () => ({
  get: jest.fn(),
  set: jest.fn(),
  remove: jest.fn(),
}));

jest.mock('@/lib/services/http', () => ({
  api: {
    get: jest.fn(),
    post: jest.fn(),
    patch: jest.fn(),
    delete: jest.fn(),
  },
}));

const mockedApi = api as jest.Mocked<typeof api>;

const MOCK_SUBSCRIPTION: AdminSubscription = {
  id: 1,
  customer_id: 10,
  customer_email: 'cliente@kore.com',
  customer_name: 'Cliente Uno',
  package: {
    id: 2,
    title: 'Plan Personalizado',
    category: 'personalizado',
    sessions_count: 8,
    session_duration_minutes: 60,
    price: '400000',
    currency: 'COP',
    validity_days: 30,
  },
  sessions_total: 8,
  sessions_used: 2,
  sessions_remaining: 6,
  status: 'active',
  starts_at: '2026-05-01',
  expires_at: '2026-05-31',
  is_recurring: false,
  next_billing_date: null,
  billing_failed_at: null,
  is_duo: false,
  guest_info: null,
  created_at: '2026-05-01T00:00:00Z',
  updated_at: '2026-05-01T00:00:00Z',
};

function resetStore() {
  useAdminSubscriptionStore.setState({
    subscriptions: [],
    totalCount: 0,
    selected: null,
    filters: { search: '', status: '', category: '', page: 1 },
    loading: false,
    actionLoading: false,
    error: '',
  });
}

describe('adminSubscriptionStore', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    resetStore();
    (Cookies.get as jest.Mock).mockReturnValue('fake-token');
  });

  describe('fetchSubscriptions', () => {
    it('stores subscriptions and totalCount on success (paginated response)', async () => {
      (mockedApi.get as jest.Mock).mockResolvedValueOnce({
        data: { results: [MOCK_SUBSCRIPTION], count: 1 },
      });

      await useAdminSubscriptionStore.getState().fetchSubscriptions();

      const state = useAdminSubscriptionStore.getState();
      expect(state.subscriptions).toHaveLength(1);
      expect(state.subscriptions[0].id).toBe(1);
      expect(state.totalCount).toBe(1);
      expect(state.loading).toBe(false);
    });

    it('handles flat array response (no pagination wrapper)', async () => {
      (mockedApi.get as jest.Mock).mockResolvedValueOnce({
        data: [MOCK_SUBSCRIPTION],
      });

      await useAdminSubscriptionStore.getState().fetchSubscriptions();

      const state = useAdminSubscriptionStore.getState();
      expect(state.subscriptions).toHaveLength(1);
      expect(state.totalCount).toBe(1);
    });

    it('passes search, status, and category filters as query params', async () => {
      (mockedApi.get as jest.Mock).mockResolvedValueOnce({ data: { results: [], count: 0 } });

      await useAdminSubscriptionStore.getState().fetchSubscriptions({
        search: 'cliente',
        status: 'active',
        category: 'personalizado',
        page: 2,
      });

      expect(mockedApi.get).toHaveBeenCalledWith('/subscriptions/', {
        headers: { Authorization: 'Bearer fake-token' },
        params: { page: 2, search: 'cliente', status: 'active', category: 'personalizado' },
      });
    });

    it('omits empty filter params', async () => {
      (mockedApi.get as jest.Mock).mockResolvedValueOnce({ data: { results: [], count: 0 } });

      await useAdminSubscriptionStore.getState().fetchSubscriptions();

      const callParams = (mockedApi.get as jest.Mock).mock.calls[0][1].params;
      expect(callParams.search).toBeUndefined();
      expect(callParams.status).toBeUndefined();
      expect(callParams.category).toBeUndefined();
    });

    it('sets error message and clears loading on failure', async () => {
      (mockedApi.get as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

      await useAdminSubscriptionStore.getState().fetchSubscriptions();

      const state = useAdminSubscriptionStore.getState();
      expect(state.error).toBe('No se pudieron cargar las suscripciones.');
      expect(state.loading).toBe(false);
    });
  });

  describe('fetchById', () => {
    it('sets selected to the fetched subscription', async () => {
      (mockedApi.get as jest.Mock).mockResolvedValueOnce({ data: MOCK_SUBSCRIPTION });

      await useAdminSubscriptionStore.getState().fetchById(1);

      expect(useAdminSubscriptionStore.getState().selected).toEqual(MOCK_SUBSCRIPTION);
      expect(useAdminSubscriptionStore.getState().loading).toBe(false);
    });

    it('calls the correct endpoint', async () => {
      (mockedApi.get as jest.Mock).mockResolvedValueOnce({ data: MOCK_SUBSCRIPTION });

      await useAdminSubscriptionStore.getState().fetchById(42);

      expect(mockedApi.get).toHaveBeenCalledWith('/subscriptions/42/', {
        headers: { Authorization: 'Bearer fake-token' },
      });
    });

    it('sets error on failure', async () => {
      (mockedApi.get as jest.Mock).mockRejectedValueOnce(new Error('Not found'));

      await useAdminSubscriptionStore.getState().fetchById(999);

      const state = useAdminSubscriptionStore.getState();
      expect(state.error).toBe('No se pudo cargar la suscripción.');
      expect(state.loading).toBe(false);
    });
  });

  describe('patchSubscription', () => {
    it('PATCHes and updates selected, returns true on success', async () => {
      const updated = { ...MOCK_SUBSCRIPTION, sessions_total: 12 };
      (mockedApi.patch as jest.Mock).mockResolvedValueOnce({ data: updated });

      const result = await useAdminSubscriptionStore.getState().patchSubscription(1, {
        sessions_total: 12,
      });

      expect(result).toBe(true);
      expect(mockedApi.patch).toHaveBeenCalledWith(
        '/subscriptions/1/',
        { sessions_total: 12 },
        expect.anything(),
      );
      expect(useAdminSubscriptionStore.getState().selected).toEqual(updated);
      expect(useAdminSubscriptionStore.getState().actionLoading).toBe(false);
    });

    it('sets error and returns false on failure', async () => {
      (mockedApi.patch as jest.Mock).mockRejectedValueOnce(new Error('Server error'));

      const result = await useAdminSubscriptionStore.getState().patchSubscription(1, {
        status: 'canceled',
      });

      expect(result).toBe(false);
      expect(useAdminSubscriptionStore.getState().error).toBe('No se pudo actualizar la suscripción.');
      expect(useAdminSubscriptionStore.getState().actionLoading).toBe(false);
    });
  });

  describe('renewSubscription', () => {
    it('POSTs to admin-renew and returns the renewed subscription', async () => {
      const renewed = { ...MOCK_SUBSCRIPTION, id: 2, starts_at: '2026-06-01' };
      (mockedApi.post as jest.Mock).mockResolvedValueOnce({ data: renewed });

      const result = await useAdminSubscriptionStore.getState().renewSubscription(1);

      expect(mockedApi.post).toHaveBeenCalledWith(
        '/subscriptions/1/admin-renew/',
        {},
        expect.anything(),
      );
      expect(result).toEqual(renewed);
      expect(useAdminSubscriptionStore.getState().actionLoading).toBe(false);
    });

    it('returns null and sets error on failure', async () => {
      (mockedApi.post as jest.Mock).mockRejectedValueOnce(new Error('Renewal failed'));

      const result = await useAdminSubscriptionStore.getState().renewSubscription(1);

      expect(result).toBeNull();
      expect(useAdminSubscriptionStore.getState().error).toBe('No se pudo renovar la suscripción.');
    });
  });

  describe('deleteSubscription', () => {
    it('DELETEs and removes subscription from list, returns ok: true', async () => {
      useAdminSubscriptionStore.setState({ subscriptions: [MOCK_SUBSCRIPTION], totalCount: 1 });
      (mockedApi.delete as jest.Mock).mockResolvedValueOnce({});

      const result = await useAdminSubscriptionStore.getState().deleteSubscription(1);

      expect(result).toEqual({ ok: true });
      expect(mockedApi.delete).toHaveBeenCalledWith(
        '/subscriptions/1/admin-delete/',
        expect.anything(),
      );
      expect(useAdminSubscriptionStore.getState().subscriptions).toHaveLength(0);
    });

    it('clears selected if the deleted subscription was selected', async () => {
      useAdminSubscriptionStore.setState({
        subscriptions: [MOCK_SUBSCRIPTION],
        selected: MOCK_SUBSCRIPTION,
      });
      (mockedApi.delete as jest.Mock).mockResolvedValueOnce({});

      await useAdminSubscriptionStore.getState().deleteSubscription(1);

      expect(useAdminSubscriptionStore.getState().selected).toBeNull();
    });

    it('returns ok: false with detail message extracted from error response', async () => {
      (mockedApi.delete as jest.Mock).mockRejectedValueOnce({
        response: { data: { detail: 'Tiene sesiones pendientes.' } },
      });

      const result = await useAdminSubscriptionStore.getState().deleteSubscription(1);

      expect(result).toEqual({ ok: false, detail: 'Tiene sesiones pendientes.' });
      expect(useAdminSubscriptionStore.getState().error).toBe('Tiene sesiones pendientes.');
    });

    it('uses fallback detail when error has no response body', async () => {
      (mockedApi.delete as jest.Mock).mockRejectedValueOnce(new Error('Network'));

      const result = await useAdminSubscriptionStore.getState().deleteSubscription(1);

      expect(result).toEqual({ ok: false, detail: 'No se pudo eliminar la suscripción.' });
    });
  });

  describe('createOrEvolveSubscription', () => {
    it('POSTs to admin-create and returns ok: true with subscription on success', async () => {
      (mockedApi.post as jest.Mock).mockResolvedValueOnce({ data: MOCK_SUBSCRIPTION });

      const result = await useAdminSubscriptionStore.getState().createOrEvolveSubscription({
        action: 'create',
        customer_id: 10,
        package_id: 2,
        payment_method: 'cash',
      });

      expect(result).toEqual({ ok: true, subscription: MOCK_SUBSCRIPTION });
      expect(mockedApi.post).toHaveBeenCalledWith(
        '/subscriptions/admin-create/',
        expect.objectContaining({ action: 'create', customer_id: 10 }),
        expect.anything(),
      );
      expect(useAdminSubscriptionStore.getState().actionLoading).toBe(false);
    });

    it('returns ok: false with structured error including status, detail, and expectedAction', async () => {
      (mockedApi.post as jest.Mock).mockRejectedValueOnce({
        response: {
          status: 409,
          data: { detail: 'Ya existe una suscripción activa.', expected_action: 'evolve' },
        },
      });

      const result = await useAdminSubscriptionStore.getState().createOrEvolveSubscription({
        action: 'create',
        customer_id: 10,
        package_id: 2,
        payment_method: 'cash',
      });

      expect(result).toEqual({
        ok: false,
        error: {
          status: 409,
          detail: 'Ya existe una suscripción activa.',
          expectedAction: 'evolve',
        },
      });
      expect(useAdminSubscriptionStore.getState().error).toBe('Ya existe una suscripción activa.');
    });

    it('uses status 0 and fallback detail when error has no response', async () => {
      (mockedApi.post as jest.Mock).mockRejectedValueOnce(new Error('Network'));

      const result = await useAdminSubscriptionStore.getState().createOrEvolveSubscription({
        action: 'create',
        customer_id: 10,
        package_id: 2,
        payment_method: 'cash',
      });

      expect(result).toEqual({
        ok: false,
        error: {
          status: 0,
          detail: 'No se pudo registrar la suscripción.',
          expectedAction: null,
        },
      });
    });
  });

  describe('setFilters', () => {
    it('merges partial filters into existing filter state', () => {
      useAdminSubscriptionStore.getState().setFilters({ search: 'juan', page: 2 });

      const { filters } = useAdminSubscriptionStore.getState();
      expect(filters.search).toBe('juan');
      expect(filters.page).toBe(2);
      expect(filters.status).toBe('');
      expect(filters.category).toBe('');
    });
  });

  describe('reset', () => {
    it('clears all state to initial values', () => {
      useAdminSubscriptionStore.setState({
        subscriptions: [MOCK_SUBSCRIPTION],
        totalCount: 5,
        selected: MOCK_SUBSCRIPTION,
        error: 'Algo falló',
        loading: true,
        actionLoading: true,
      });

      useAdminSubscriptionStore.getState().reset();

      const state = useAdminSubscriptionStore.getState();
      expect(state.subscriptions).toHaveLength(0);
      expect(state.totalCount).toBe(0);
      expect(state.selected).toBeNull();
      expect(state.error).toBe('');
      expect(state.filters).toEqual({ search: '', status: '', category: '', page: 1 });
    });
  });
});
