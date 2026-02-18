import Cookies from 'js-cookie';
import { useCheckoutStore } from '@/lib/stores/checkoutStore';
import { api } from '@/lib/services/http';
import { AxiosError, AxiosHeaders } from 'axios';
import { useAuthStore } from '@/lib/stores/authStore';

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
  description: 'Premium package',
  sessions_count: 12,
  price: '500000',
  currency: 'COP',
  validity_days: 30,
  is_active: true,
};

const MOCK_WOMPI_CONFIG = {
  public_key: 'pub_test_abc123',
  environment: 'sandbox',
};

const MOCK_CHECKOUT_PREPARATION = {
  reference: 'ref-prepare-001',
  signature: 'sig-prepare-001',
  amount_in_cents: 50000000,
  currency: 'COP',
  package_title: 'Gold',
};

const MOCK_INTENT_PENDING = {
  id: 10,
  reference: 'ref-test-001',
  wompi_transaction_id: 'txn-test-001',
  status: 'pending' as const,
  amount: '500000',
  currency: 'COP',
  package_title: 'Gold',
  created_at: '2025-02-15T00:00:00Z',
};

const MOCK_INTENT_APPROVED = {
  ...MOCK_INTENT_PENDING,
  status: 'approved' as const,
};

const MOCK_INTENT_APPROVED_WITH_AUTO_LOGIN = {
  ...MOCK_INTENT_APPROVED,
  auto_login: {
    access: 'auto-access-token',
    refresh: 'auto-refresh-token',
    user: {
      id: 55,
      email: 'guest@kore.com',
      first_name: 'Guest',
      last_name: 'Customer',
      phone: '3000000000',
      role: 'customer',
    },
  },
};

const MOCK_INTENT_APPROVED_WITH_AUTO_LOGIN_NO_NAME = {
  ...MOCK_INTENT_APPROVED,
  auto_login: {
    access: 'auto-access-token',
    refresh: 'auto-refresh-token',
    user: {
      id: 56,
      email: 'nameless@kore.com',
      first_name: '',
      last_name: '',
      phone: '',
      role: 'customer',
    },
  },
};

const MOCK_INTENT_FAILED = {
  ...MOCK_INTENT_PENDING,
  status: 'failed' as const,
};

function resetStore() {
  useCheckoutStore.setState({
    package_: null,
    wompiConfig: null,
    loading: false,
    paymentStatus: 'idle',
    intentResult: null,
    error: '',
  });

  useAuthStore.setState({
    user: null,
    accessToken: null,
    isAuthenticated: false,
    justLoggedIn: false,
    hydrated: true,
  });
}

describe('checkoutStore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    resetStore();
    mockedCookies.get.mockReturnValue('fake-token');
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  // ----------------------------------------------------------------
  // fetchPackage
  // ----------------------------------------------------------------
  describe('fetchPackage', () => {
    it('loads package on success', async () => {
      mockedApi.get.mockResolvedValueOnce({ data: MOCK_PACKAGE });
      await useCheckoutStore.getState().fetchPackage('1');
      const state = useCheckoutStore.getState();
      expect(state.package_).toEqual(MOCK_PACKAGE);
      expect(state.loading).toBe(false);
      expect(state.error).toBe('');
    });

    it('sets error on failure', async () => {
      mockedApi.get.mockRejectedValueOnce(new Error('fail'));
      await useCheckoutStore.getState().fetchPackage('1');
      const state = useCheckoutStore.getState();
      expect(state.error).toBe('No se pudo cargar el paquete.');
      expect(state.loading).toBe(false);
    });
  });

  // ----------------------------------------------------------------
  // fetchWompiConfig
  // ----------------------------------------------------------------
  describe('fetchWompiConfig', () => {
    it('loads wompi config on success', async () => {
      mockedApi.get.mockResolvedValueOnce({ data: MOCK_WOMPI_CONFIG });
      await useCheckoutStore.getState().fetchWompiConfig();
      expect(useCheckoutStore.getState().wompiConfig).toEqual(MOCK_WOMPI_CONFIG);
    });

    it('sets error when public key is missing', async () => {
      mockedApi.get.mockResolvedValueOnce({ data: { public_key: '', environment: 'sandbox' } });
      await useCheckoutStore.getState().fetchWompiConfig();
      const state = useCheckoutStore.getState();
      expect(state.wompiConfig).toBeNull();
      expect(state.error).toBe('No se pudo cargar la configuración de pago.');
    });

    it('sets error on failure', async () => {
      mockedApi.get.mockRejectedValueOnce(new Error('fail'));
      await useCheckoutStore.getState().fetchWompiConfig();
      expect(useCheckoutStore.getState().error).toBe('No se pudo cargar la configuración de pago.');
    });
  });

  // ----------------------------------------------------------------
  // generateSignature
  // ----------------------------------------------------------------
  describe('generateSignature', () => {
    it('returns signature data and uses auth header when token exists', async () => {
      const signatureData = { signature: 'sig-001', reference: 'ref-001' };
      mockedApi.post.mockResolvedValueOnce({ data: signatureData });

      const result = await useCheckoutStore.getState().generateSignature(500000, 'COP');

      expect(result).toEqual(signatureData);
      expect(mockedApi.post).toHaveBeenCalledWith(
        '/wompi/generate-signature/',
        expect.objectContaining({
          reference: expect.stringMatching(/^kore-/),
          amount_in_cents: 500000,
          currency: 'COP',
        }),
        { headers: { Authorization: 'Bearer fake-token' } },
      );
    });

    it('sends no auth header when token is missing', async () => {
      mockedCookies.get.mockReturnValue(undefined);
      const signatureData = { signature: 'sig-002', reference: 'ref-002' };
      mockedApi.post.mockResolvedValueOnce({ data: signatureData });

      const result = await useCheckoutStore.getState().generateSignature(1200, 'USD');

      expect(result).toEqual(signatureData);
      expect(mockedApi.post).toHaveBeenCalledWith(
        '/wompi/generate-signature/',
        expect.objectContaining({
          reference: expect.stringMatching(/^kore-/),
          amount_in_cents: 1200,
          currency: 'USD',
        }),
        undefined,
      );
    });

    it('sets error when signature generation fails', async () => {
      mockedApi.post.mockRejectedValueOnce(new Error('fail'));

      const result = await useCheckoutStore.getState().generateSignature(2000, 'COP');

      expect(result).toBeNull();
      expect(useCheckoutStore.getState().error).toBe('No se pudo generar la firma de pago.');
    });
  });

  // ----------------------------------------------------------------
  // prepareCheckout
  // ----------------------------------------------------------------
  describe('prepareCheckout', () => {
    it('returns preparation payload', async () => {
      mockedApi.post.mockResolvedValueOnce({ data: MOCK_CHECKOUT_PREPARATION });
      const result = await useCheckoutStore.getState().prepareCheckout(1);
      expect(result).toEqual(MOCK_CHECKOUT_PREPARATION);
    });

    it('sends correct payload', async () => {
      mockedApi.post.mockResolvedValueOnce({ data: MOCK_CHECKOUT_PREPARATION });
      await useCheckoutStore.getState().prepareCheckout(1, 'reg-token-123');
      expect(mockedApi.post).toHaveBeenCalledWith(
        '/subscriptions/prepare-checkout/',
        { package_id: 1, registration_token: 'reg-token-123' },
        { headers: { Authorization: 'Bearer fake-token' } },
      );
    });

    it('sets error on failure', async () => {
      const axiosError = new AxiosError('fail', '400', undefined, undefined, {
        data: { detail: 'Checkout inválido.' },
        status: 400,
        statusText: 'Bad Request',
        headers: {},
        config: { headers: new AxiosHeaders() },
      });
      mockedApi.post.mockRejectedValueOnce(axiosError);
      const result = await useCheckoutStore.getState().prepareCheckout(1);
      expect(result).toBeNull();
      expect(useCheckoutStore.getState().error).toBe('Checkout inválido.');
    });

    it('uses fallback error and no auth header when token is missing', async () => {
      mockedCookies.get.mockReturnValue(undefined);
      mockedApi.post.mockRejectedValueOnce(new Error('fail'));

      const result = await useCheckoutStore.getState().prepareCheckout(1);

      expect(result).toBeNull();
      expect(mockedApi.post).toHaveBeenCalledWith(
        '/subscriptions/prepare-checkout/',
        { package_id: 1 },
        undefined,
      );
      expect(useCheckoutStore.getState().error).toBe('No se pudo preparar el pago. Intenta de nuevo.');
    });
  });

  // ----------------------------------------------------------------
  // purchaseSubscription
  // ----------------------------------------------------------------
  describe('purchaseSubscription', () => {
    it('creates intent and polls until approved, returns true', async () => {
      // Purchase returns pending intent
      mockedApi.post.mockResolvedValueOnce({ data: MOCK_INTENT_PENDING });
      // First poll returns pending, second returns approved
      mockedApi.get
        .mockResolvedValueOnce({ data: MOCK_INTENT_PENDING })
        .mockResolvedValueOnce({ data: MOCK_INTENT_APPROVED });

      const promise = useCheckoutStore.getState().purchaseSubscription(1, 'card-token-abc');

      // After purchase, state should be 'polling'
      await jest.advanceTimersByTimeAsync(0);
      expect(useCheckoutStore.getState().paymentStatus).toBe('polling');

      // First poll (pending)
      await jest.advanceTimersByTimeAsync(2000);
      // Second poll (approved)
      await jest.advanceTimersByTimeAsync(2000);

      const result = await promise;
      expect(result).toBe(true);
      const state = useCheckoutStore.getState();
      expect(state.paymentStatus).toBe('success');
      expect(state.intentResult).toEqual(MOCK_INTENT_APPROVED);
    });

    it('sends correct payload with auth header', async () => {
      mockedApi.post.mockResolvedValueOnce({ data: MOCK_INTENT_PENDING });
      mockedApi.get.mockResolvedValueOnce({ data: MOCK_INTENT_APPROVED });

      const promise = useCheckoutStore.getState().purchaseSubscription(1, 'card-token-abc');
      await jest.advanceTimersByTimeAsync(2000);
      await promise;

      expect(mockedApi.post).toHaveBeenCalledWith(
        '/subscriptions/purchase/',
        { package_id: 1, card_token: 'card-token-abc' },
        { headers: { Authorization: 'Bearer fake-token' } },
      );
    });

    it('omits auth header when token is missing', async () => {
      mockedCookies.get.mockReturnValue(undefined);
      mockedApi.post.mockResolvedValueOnce({ data: MOCK_INTENT_PENDING });
      mockedApi.get.mockResolvedValueOnce({ data: MOCK_INTENT_APPROVED });

      const promise = useCheckoutStore.getState().purchaseSubscription(1, 'card-token-abc');
      await jest.advanceTimersByTimeAsync(2000);
      await promise;

      expect(mockedApi.post).toHaveBeenCalledWith(
        '/subscriptions/purchase/',
        { package_id: 1, card_token: 'card-token-abc' },
        undefined,
      );
    });

    it('includes registration token when provided', async () => {
      mockedApi.post.mockResolvedValueOnce({ data: MOCK_INTENT_PENDING });
      mockedApi.get.mockResolvedValueOnce({ data: MOCK_INTENT_APPROVED });

      const promise = useCheckoutStore.getState().purchaseSubscription(1, 'card-token-abc', 'reg-token-321');
      await jest.advanceTimersByTimeAsync(2000);
      await promise;

      expect(mockedApi.post).toHaveBeenCalledWith(
        '/subscriptions/purchase/',
        { package_id: 1, card_token: 'card-token-abc', registration_token: 'reg-token-321' },
        { headers: { Authorization: 'Bearer fake-token' } },
      );
    });

    it('returns false when polling resolves to failed', async () => {
      mockedApi.post.mockResolvedValueOnce({ data: MOCK_INTENT_PENDING });
      mockedApi.get.mockResolvedValueOnce({ data: MOCK_INTENT_FAILED });

      const promise = useCheckoutStore.getState().purchaseSubscription(1, 'card-token-abc');
      await jest.advanceTimersByTimeAsync(2000);
      const result = await promise;

      expect(result).toBe(false);
      const state = useCheckoutStore.getState();
      expect(state.paymentStatus).toBe('error');
      expect(state.error).toBe('El pago fue rechazado. Intenta con otro método de pago.');
    });

    it('sets error from API detail on purchase failure', async () => {
      const axiosError = new AxiosError('fail', '400', undefined, undefined, {
        data: { detail: 'Tarjeta rechazada.' },
        status: 400,
        statusText: 'Bad Request',
        headers: {},
        config: { headers: new AxiosHeaders() },
      });
      mockedApi.post.mockRejectedValueOnce(axiosError);
      const result = await useCheckoutStore.getState().purchaseSubscription(1, 'bad-token');
      expect(result).toBe(false);
      const state = useCheckoutStore.getState();
      expect(state.paymentStatus).toBe('error');
      expect(state.error).toBe('Tarjeta rechazada.');
    });

    it('uses generic error when no detail in response', async () => {
      mockedApi.post.mockRejectedValueOnce(new Error('Network Error'));
      const result = await useCheckoutStore.getState().purchaseSubscription(1, 'token');
      expect(result).toBe(false);
      expect(useCheckoutStore.getState().error).toBe('Error al procesar el pago. Intenta de nuevo.');
    });
  });

  // ----------------------------------------------------------------
  // pollIntentStatus
  // ----------------------------------------------------------------
  describe('pollIntentStatus', () => {
    it('ignores transient polling errors and continues', async () => {
      // First poll fails, second succeeds with approved
      mockedApi.get
        .mockRejectedValueOnce(new Error('network hiccup'))
        .mockResolvedValueOnce({ data: MOCK_INTENT_APPROVED });

      const promise = useCheckoutStore.getState().pollIntentStatus('ref-test-001');
      await jest.advanceTimersByTimeAsync(2000);
      await jest.advanceTimersByTimeAsync(2000);
      const result = await promise;
      expect(result).toBe(true);
    });

    it('uses guest access token when no auth cookie is present', async () => {
      mockedCookies.get.mockReturnValue(undefined);
      mockedApi.get.mockResolvedValueOnce({ data: MOCK_INTENT_APPROVED });

      const promise = useCheckoutStore.getState().pollIntentStatus('ref-guest-001', 'guest-access-123');
      await jest.advanceTimersByTimeAsync(2000);
      const result = await promise;

      expect(result).toBe(true);
      expect(mockedApi.get).toHaveBeenCalledWith(
        '/subscriptions/intent-status/ref-guest-001/',
        { params: { access_token: 'guest-access-123' } },
      );
    });

    it('omits request config when no token or params are provided', async () => {
      mockedCookies.get.mockReturnValue(undefined);
      mockedApi.get.mockResolvedValueOnce({ data: MOCK_INTENT_APPROVED });

      const promise = useCheckoutStore.getState().pollIntentStatus('ref-no-token-001');
      await jest.advanceTimersByTimeAsync(2000);
      const result = await promise;

      expect(result).toBe(true);
      expect(mockedApi.get).toHaveBeenCalledWith(
        '/subscriptions/intent-status/ref-no-token-001/',
        undefined,
      );
    });

    it('includes transaction_id param when provided', async () => {
      mockedApi.get.mockResolvedValueOnce({ data: MOCK_INTENT_APPROVED });

      const promise = useCheckoutStore.getState().pollIntentStatus('ref-txn-001', undefined, 'txn-123');
      await jest.advanceTimersByTimeAsync(2000);
      await promise;

      expect(mockedApi.get).toHaveBeenCalledWith(
        '/subscriptions/intent-status/ref-txn-001/',
        { headers: { Authorization: 'Bearer fake-token' }, params: { transaction_id: 'txn-123' } },
      );
    });

    it('applies auto-login session when approved response includes auth payload', async () => {
      mockedCookies.get.mockReturnValue(undefined);
      mockedApi.get.mockResolvedValueOnce({ data: MOCK_INTENT_APPROVED_WITH_AUTO_LOGIN });

      const promise = useCheckoutStore.getState().pollIntentStatus('ref-auto-001', 'guest-token-auto');
      await jest.advanceTimersByTimeAsync(2000);
      const result = await promise;

      expect(result).toBe(true);
      const authState = useAuthStore.getState();
      expect(authState.isAuthenticated).toBe(true);
      expect(authState.accessToken).toBe('auto-access-token');
      expect(authState.user?.email).toBe('guest@kore.com');
      expect(mockedCookies.set).toHaveBeenCalledWith('kore_token', 'auto-access-token', { expires: 7 });
      expect(mockedCookies.set).toHaveBeenCalledWith('kore_refresh', 'auto-refresh-token', { expires: 7 });
      expect(mockedCookies.set).toHaveBeenCalledWith('kore_user', expect.any(String), { expires: 7 });
    });

    it('falls back to email when auto-login lacks name fields', async () => {
      mockedCookies.get.mockReturnValue(undefined);
      mockedApi.get.mockResolvedValueOnce({ data: MOCK_INTENT_APPROVED_WITH_AUTO_LOGIN_NO_NAME });

      const promise = useCheckoutStore.getState().pollIntentStatus('ref-auto-002', 'guest-token-auto');
      await jest.advanceTimersByTimeAsync(2000);
      const result = await promise;

      expect(result).toBe(true);
      const authState = useAuthStore.getState();
      expect(authState.user?.email).toBe('nameless@kore.com');
      expect(authState.user?.name).toBe('nameless@kore.com');
      expect(authState.user?.first_name).toBe('');
      expect(authState.user?.last_name).toBe('');
      expect(authState.user?.phone).toBe('');
    });

    it('sets error after exceeding max polling attempts', async () => {
      mockedApi.get.mockResolvedValue({ data: MOCK_INTENT_PENDING });

      const promise = useCheckoutStore.getState().pollIntentStatus('ref-timeout-001');
      for (let i = 0; i < 30; i += 1) {
        await jest.advanceTimersByTimeAsync(2000);
      }
      const result = await promise;

      expect(result).toBe(false);
      const state = useCheckoutStore.getState();
      expect(state.paymentStatus).toBe('error');
      expect(state.error).toBe('El pago está tardando más de lo esperado. Revisa tu estado en unos minutos.');
    });
  });

  // ----------------------------------------------------------------
  // reset
  // ----------------------------------------------------------------
  describe('reset', () => {
    it('resets all state to initial values', () => {
      useCheckoutStore.setState({
        package_: MOCK_PACKAGE,
        wompiConfig: MOCK_WOMPI_CONFIG,
        loading: true,
        paymentStatus: 'success',
        intentResult: MOCK_INTENT_APPROVED,
        error: 'some error',
      });

      useCheckoutStore.getState().reset();
      const state = useCheckoutStore.getState();
      expect(state.package_).toBeNull();
      expect(state.wompiConfig).toBeNull();
      expect(state.loading).toBe(false);
      expect(state.paymentStatus).toBe('idle');
      expect(state.intentResult).toBeNull();
      expect(state.error).toBe('');
    });
  });
});
