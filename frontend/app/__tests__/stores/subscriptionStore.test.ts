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
  paused_at: null,
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

function resetStore() {
  useSubscriptionStore.setState({
    subscriptions: [],
    activeSubscription: null,
    payments: [],
    loading: false,
    actionLoading: false,
    error: '',
  });
}

describe('subscriptionStore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetStore();
    mockedCookies.get.mockReturnValue('fake-token');
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

    it('sets activeSubscription to null when no active/paused subscription', async () => {
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
  // pauseSubscription
  // ----------------------------------------------------------------
  describe('pauseSubscription', () => {
    it('updates subscription status and returns true on success', async () => {
      useSubscriptionStore.setState({ subscriptions: [MOCK_SUBSCRIPTION] });
      const pausedData = { status: 'paused', paused_at: '2025-02-15T00:00:00Z' };
      mockedApi.post.mockResolvedValueOnce({ data: pausedData });

      const result = await useSubscriptionStore.getState().pauseSubscription(2);
      expect(result).toBe(true);

      const state = useSubscriptionStore.getState();
      expect(state.subscriptions[0].status).toBe('paused');
      expect(state.activeSubscription?.status).toBe('paused');
      expect(state.actionLoading).toBe(false);
    });

    it('sets activeSubscription to null when no active/paused sub remains after pause', async () => {
      const otherSub = { ...MOCK_SUBSCRIPTION, id: 99, status: 'expired' as const };
      useSubscriptionStore.setState({ subscriptions: [MOCK_SUBSCRIPTION, otherSub] });
      mockedApi.post.mockResolvedValueOnce({ data: { status: 'expired' } });

      await useSubscriptionStore.getState().pauseSubscription(2);
      const state = useSubscriptionStore.getState();
      expect(state.subscriptions[1]).toEqual(otherSub);
      expect(state.activeSubscription).toBeNull();
    });

    it('sets error and returns false on failure', async () => {
      useSubscriptionStore.setState({ subscriptions: [MOCK_SUBSCRIPTION] });
      mockedApi.post.mockRejectedValueOnce(new Error('fail'));

      const result = await useSubscriptionStore.getState().pauseSubscription(2);
      expect(result).toBe(false);
      expect(useSubscriptionStore.getState().error).toBe('No se pudo pausar la suscripción.');
      expect(useSubscriptionStore.getState().actionLoading).toBe(false);
    });
  });

  // ----------------------------------------------------------------
  // resumeSubscription
  // ----------------------------------------------------------------
  describe('resumeSubscription', () => {
    it('updates subscription status and returns true on success', async () => {
      const paused = { ...MOCK_SUBSCRIPTION, status: 'paused' as const };
      useSubscriptionStore.setState({ subscriptions: [paused] });
      const resumedData = { status: 'active', paused_at: null };
      mockedApi.post.mockResolvedValueOnce({ data: resumedData });

      const result = await useSubscriptionStore.getState().resumeSubscription(2);
      expect(result).toBe(true);

      const state = useSubscriptionStore.getState();
      expect(state.subscriptions[0].status).toBe('active');
      expect(state.activeSubscription?.status).toBe('active');
      expect(state.actionLoading).toBe(false);
    });

    it('sets activeSubscription to null when no active/paused sub remains after resume', async () => {
      const otherSub = { ...MOCK_SUBSCRIPTION, id: 99, status: 'expired' as const };
      const paused = { ...MOCK_SUBSCRIPTION, status: 'paused' as const };
      useSubscriptionStore.setState({ subscriptions: [paused, otherSub] });
      mockedApi.post.mockResolvedValueOnce({ data: { status: 'expired' } });

      await useSubscriptionStore.getState().resumeSubscription(2);
      const state = useSubscriptionStore.getState();
      expect(state.subscriptions[1]).toEqual(otherSub);
      expect(state.activeSubscription).toBeNull();
    });

    it('sets error and returns false on failure', async () => {
      useSubscriptionStore.setState({ subscriptions: [MOCK_SUBSCRIPTION] });
      mockedApi.post.mockRejectedValueOnce(new Error('fail'));

      const result = await useSubscriptionStore.getState().resumeSubscription(2);
      expect(result).toBe(false);
      expect(useSubscriptionStore.getState().error).toBe('No se pudo reanudar la suscripción.');
      expect(useSubscriptionStore.getState().actionLoading).toBe(false);
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

    it('preserves non-matching subscriptions and sets null when none active/paused', async () => {
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
      mockedApi.get.mockRejectedValueOnce(new Error('fail'));
      await useSubscriptionStore.getState().fetchPaymentHistory(2);
      expect(useSubscriptionStore.getState().error).toBe('No se pudo cargar el historial de pagos.');
    });
  });
});
