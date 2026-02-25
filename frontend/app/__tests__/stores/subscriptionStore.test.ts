import Cookies from 'js-cookie';
import { useSubscriptionStore } from '@/lib/stores/subscriptionStore';
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
  },
}));

const mockedCookies = Cookies as jest.Mocked<typeof Cookies>;
const mockedApi = api as jest.Mocked<typeof api>;

const MOCK_PACKAGE = {
  id: 1,
  title: 'Gold',
  sessions_count: 12,
  session_duration_minutes: 60,
  price: '500000',
  currency: 'COP',
  validity_days: 30,
};

const MOCK_SUBSCRIPTION = {
  id: 2,
  customer_email: 'cust@kore.com',
  package: MOCK_PACKAGE,
  sessions_total: 12,
  sessions_used: 3,
  sessions_remaining: 9,
  status: 'active' as const,
  starts_at: '2025-02-01T00:00:00Z',
  expires_at: '2025-03-01T00:00:00Z',
  next_billing_date: null,
};

const MOCK_PAYMENT = {
  id: 10,
  amount: '500000',
  currency: 'COP',
  status: 'approved',
  provider: 'wompi',
  provider_reference: 'ref-123',
  created_at: '2025-02-01T00:00:00Z',
};

const MOCK_EXPIRING_SUBSCRIPTION = {
  ...MOCK_SUBSCRIPTION,
  id: 7,
  expires_at: '2025-03-03T00:00:00Z',
};

function resetStore() {
  useSubscriptionStore.setState({
    subscriptions: [],
    activeSubscription: null,
    selectedSubscriptionId: null,
    payments: [],
    expiryReminder: null,
    loading: false,
    actionLoading: false,
    error: '',
  });
}

describe('subscriptionStore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetStore();
    (mockedCookies.get as jest.Mock).mockReturnValue('fake-token');
  });

  // ----------------------------------------------------------------
  // fetchSubscriptions
  // ----------------------------------------------------------------
  describe('fetchSubscriptions', () => {
    it('populates subscriptions and sets activeSubscription from paginated response', async () => {
      mockedApi.get.mockResolvedValueOnce({ data: { results: [MOCK_SUBSCRIPTION] } });
      await useSubscriptionStore.getState().fetchSubscriptions();
      const state = useSubscriptionStore.getState();
      expect(state.subscriptions).toHaveLength(1);
      expect(state.activeSubscription).toEqual(MOCK_SUBSCRIPTION);
      expect(state.loading).toBe(false);
    });

    it('populates subscriptions from flat array response', async () => {
      mockedApi.get.mockResolvedValueOnce({ data: [MOCK_SUBSCRIPTION] });
      await useSubscriptionStore.getState().fetchSubscriptions();
      const state = useSubscriptionStore.getState();
      expect(state.subscriptions).toHaveLength(1);
      expect(state.activeSubscription).toEqual(MOCK_SUBSCRIPTION);
    });

    it('sets activeSubscription to null when no active subscription', async () => {
      const expired = { ...MOCK_SUBSCRIPTION, status: 'expired' as const };
      mockedApi.get.mockResolvedValueOnce({ data: [expired] });
      await useSubscriptionStore.getState().fetchSubscriptions();
      expect(useSubscriptionStore.getState().activeSubscription).toBeNull();
    });

    it('sets error on failure', async () => {
      mockedApi.get.mockRejectedValueOnce(new Error('Network'));
      await useSubscriptionStore.getState().fetchSubscriptions();
      const state = useSubscriptionStore.getState();
      expect(state.error).toBe('No se pudieron cargar las suscripciones.');
      expect(state.loading).toBe(false);
    });
  });

  // ----------------------------------------------------------------
  // setSelectedSubscriptionId
  // ----------------------------------------------------------------
  describe('setSelectedSubscriptionId', () => {
    it('sets selected subscription and clears payments/error', () => {
      useSubscriptionStore.setState({
        payments: [MOCK_PAYMENT],
        error: 'Error previo',
      });

      useSubscriptionStore.getState().setSelectedSubscriptionId(5);
      const state = useSubscriptionStore.getState();
      expect(state.selectedSubscriptionId).toBe(5);
      expect(state.payments).toEqual([]);
      expect(state.error).toBe('');
    });

    it('allows clearing selection', () => {
      useSubscriptionStore.setState({ selectedSubscriptionId: 2 });
      useSubscriptionStore.getState().setSelectedSubscriptionId(null);
      expect(useSubscriptionStore.getState().selectedSubscriptionId).toBeNull();
    });
  });

  // ----------------------------------------------------------------
  // cancelSubscription
  // ----------------------------------------------------------------
  describe('cancelSubscription', () => {
    it('updates subscription status and returns true on success', async () => {
      useSubscriptionStore.setState({ subscriptions: [MOCK_SUBSCRIPTION] });
      const canceledData = { status: 'canceled' };
      mockedApi.post.mockResolvedValueOnce({ data: canceledData });

      const result = await useSubscriptionStore.getState().cancelSubscription(2);
      expect(result).toBe(true);

      const state = useSubscriptionStore.getState();
      expect(state.subscriptions[0].status).toBe('canceled');
      expect(state.activeSubscription).toBeNull();
      expect(state.actionLoading).toBe(false);
    });

    it('preserves non-matching subscriptions and sets null when none active', async () => {
      const otherSub = { ...MOCK_SUBSCRIPTION, id: 99, status: 'expired' as const };
      useSubscriptionStore.setState({ subscriptions: [MOCK_SUBSCRIPTION, otherSub] });
      mockedApi.post.mockResolvedValueOnce({ data: { status: 'canceled' } });

      await useSubscriptionStore.getState().cancelSubscription(2);
      const state = useSubscriptionStore.getState();
      expect(state.subscriptions[1]).toEqual(otherSub);
      expect(state.activeSubscription).toBeNull();
    });

    it('sets error and returns false on failure', async () => {
      useSubscriptionStore.setState({ subscriptions: [MOCK_SUBSCRIPTION] });
      mockedApi.post.mockRejectedValueOnce(new Error('fail'));

      const result = await useSubscriptionStore.getState().cancelSubscription(2);
      expect(result).toBe(false);
      expect(useSubscriptionStore.getState().error).toBe('No se pudo cancelar la suscripción.');
      expect(useSubscriptionStore.getState().actionLoading).toBe(false);
    });
  });

  // ----------------------------------------------------------------
  // fetchPaymentHistory
  // ----------------------------------------------------------------
  describe('fetchPaymentHistory', () => {
    it('populates payments on success', async () => {
      mockedApi.get.mockResolvedValueOnce({ data: [MOCK_PAYMENT] });
      await useSubscriptionStore.getState().fetchPaymentHistory(2);
      expect(useSubscriptionStore.getState().payments).toEqual([MOCK_PAYMENT]);
      expect(useSubscriptionStore.getState().error).toBe('');
    });

    it('sets error on failure', async () => {
      useSubscriptionStore.setState({ payments: [MOCK_PAYMENT] });
      mockedApi.get.mockRejectedValueOnce(new Error('fail'));
      await useSubscriptionStore.getState().fetchPaymentHistory(2);
      expect(useSubscriptionStore.getState().error).toBe('No se pudo cargar el historial de pagos.');
      expect(useSubscriptionStore.getState().payments).toEqual([]);
    });
  });

  // ----------------------------------------------------------------
  // fetchExpiryReminder
  // ----------------------------------------------------------------
  describe('fetchExpiryReminder', () => {
    it('sets expiryReminder when subscription has id', async () => {
      mockedApi.get.mockResolvedValueOnce({ data: MOCK_EXPIRING_SUBSCRIPTION });
      await useSubscriptionStore.getState().fetchExpiryReminder();
      expect(useSubscriptionStore.getState().expiryReminder).toEqual(MOCK_EXPIRING_SUBSCRIPTION);
    });

    it('sets expiryReminder to null when response has no id', async () => {
      mockedApi.get.mockResolvedValueOnce({ data: { detail: null } });
      await useSubscriptionStore.getState().fetchExpiryReminder();
      expect(useSubscriptionStore.getState().expiryReminder).toBeNull();
    });

    it('sets expiryReminder to null on error', async () => {
      useSubscriptionStore.setState({ expiryReminder: MOCK_EXPIRING_SUBSCRIPTION });
      mockedApi.get.mockRejectedValueOnce(new Error('fail'));
      await useSubscriptionStore.getState().fetchExpiryReminder();
      expect(useSubscriptionStore.getState().expiryReminder).toBeNull();
    });
  });

  // ----------------------------------------------------------------
  // acknowledgeExpiryReminder
  // ----------------------------------------------------------------
  describe('acknowledgeExpiryReminder', () => {
    it('returns true and clears expiryReminder on success', async () => {
      useSubscriptionStore.setState({ expiryReminder: MOCK_EXPIRING_SUBSCRIPTION });
      mockedApi.post.mockResolvedValueOnce({ data: { status: 'ok' } });

      const result = await useSubscriptionStore.getState().acknowledgeExpiryReminder(7);
      expect(result).toBe(true);
      expect(useSubscriptionStore.getState().expiryReminder).toBeNull();
      expect(mockedApi.post).toHaveBeenCalledWith(
        '/subscriptions/7/expiry-reminder/ack/',
        {},
        expect.objectContaining({ headers: expect.any(Object) }),
      );
    });

    it('returns false on error and does not clear expiryReminder', async () => {
      useSubscriptionStore.setState({ expiryReminder: MOCK_EXPIRING_SUBSCRIPTION });
      mockedApi.post.mockRejectedValueOnce(new Error('fail'));

      const result = await useSubscriptionStore.getState().acknowledgeExpiryReminder(7);
      expect(result).toBe(false);
    });
  });
});
