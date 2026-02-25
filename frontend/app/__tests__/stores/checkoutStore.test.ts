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
        { package_id: 1, card_token: 'card-token-abc', installments: 1 },
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
        { package_id: 1, card_token: 'card-token-abc', installments: 1 },
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
        { package_id: 1, card_token: 'card-token-abc', installments: 1, registration_token: 'reg-token-321' },
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
  // tokenizeCard
  // ----------------------------------------------------------------
  describe('tokenizeCard', () => {
    const originalFetch = global.fetch;

    beforeEach(() => {
      useCheckoutStore.setState({ wompiConfig: MOCK_WOMPI_CONFIG });
    });

    afterEach(() => {
      global.fetch = originalFetch;
    });

    it('returns null when wompi config is missing', async () => {
      useCheckoutStore.setState({ wompiConfig: null });
      const result = await useCheckoutStore.getState().tokenizeCard({
        number: '4111111111111111',
        cvc: '123',
        exp_month: '12',
        exp_year: '28',
        card_holder: 'TEST USER',
      });
      expect(result).toBeNull();
      expect(useCheckoutStore.getState().error).toBe('Configuración de pago no disponible.');
    });

    it('returns null when wompi public key is empty', async () => {
      useCheckoutStore.setState({ wompiConfig: { public_key: '', environment: 'sandbox' } });
      const result = await useCheckoutStore.getState().tokenizeCard({
        number: '4111111111111111',
        cvc: '123',
        exp_month: '12',
        exp_year: '28',
        card_holder: 'TEST USER',
      });
      expect(result).toBeNull();
      expect(useCheckoutStore.getState().error).toBe('Configuración de pago no disponible.');
    });

    it('uses sandbox URL when environment is not prod', async () => {
      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({ status: 'CREATED', data: { id: 'tok_sandbox_123' } }),
      } as Response);

      const result = await useCheckoutStore.getState().tokenizeCard({
        number: '4111111111111111',
        cvc: '123',
        exp_month: '12',
        exp_year: '28',
        card_holder: 'TEST USER',
      });

      expect(result).toBe('tok_sandbox_123');
      expect(global.fetch).toHaveBeenCalledWith(
        'https://sandbox.wompi.co/v1/tokens/cards',
        expect.objectContaining({ method: 'POST' }),
      );
    });

    it('uses production URL when environment is prod', async () => {
      useCheckoutStore.setState({ wompiConfig: { public_key: 'pub_prod_key', environment: 'prod' } });
      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({ status: 'CREATED', data: { id: 'tok_prod_456' } }),
      } as Response);

      const result = await useCheckoutStore.getState().tokenizeCard({
        number: '4111111111111111',
        cvc: '123',
        exp_month: '12',
        exp_year: '28',
        card_holder: 'TEST USER',
      });

      expect(result).toBe('tok_prod_456');
      expect(global.fetch).toHaveBeenCalledWith(
        'https://production.wompi.co/v1/tokens/cards',
        expect.objectContaining({
          headers: expect.objectContaining({ Authorization: 'Bearer pub_prod_key' }),
        }),
      );
    });

    it('sets field-level error when response has messages object', async () => {
      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: false,
        status: 422,
        json: async () => ({
          error: {
            messages: { number: ['Invalid card number'], cvc: ['Too short'] },
          },
        }),
      } as Response);

      const result = await useCheckoutStore.getState().tokenizeCard({
        number: 'bad',
        cvc: '1',
        exp_month: '12',
        exp_year: '28',
        card_holder: 'TEST USER',
      });

      expect(result).toBeNull();
      expect(useCheckoutStore.getState().error).toContain('number:');
      expect(useCheckoutStore.getState().error).toContain('cvc:');
    });

    it('sets error message when response has error.message but no messages object', async () => {
      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({
          error: { message: 'Card declined' },
        }),
      } as Response);

      const result = await useCheckoutStore.getState().tokenizeCard({
        number: '4111111111111111',
        cvc: '123',
        exp_month: '12',
        exp_year: '28',
        card_holder: 'TEST USER',
      });

      expect(result).toBeNull();
      expect(useCheckoutStore.getState().error).toBe('Card declined');
    });

    it('uses fallback error when response JSON has no messages or message', async () => {
      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({}),
      } as Response);

      const result = await useCheckoutStore.getState().tokenizeCard({
        number: '4111111111111111',
        cvc: '123',
        exp_month: '12',
        exp_year: '28',
        card_holder: 'TEST USER',
      });

      expect(result).toBeNull();
      expect(useCheckoutStore.getState().error).toBe('Error al procesar la tarjeta. Verifica los datos.');
    });

    it('uses fallback error when response.json() throws', async () => {
      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => { throw new Error('parse error'); },
      } as Response);

      const result = await useCheckoutStore.getState().tokenizeCard({
        number: '4111111111111111',
        cvc: '123',
        exp_month: '12',
        exp_year: '28',
        card_holder: 'TEST USER',
      });

      expect(result).toBeNull();
      expect(useCheckoutStore.getState().error).toBe('Error al procesar la tarjeta. Verifica los datos.');
    });

    it('sets generic error on network failure', async () => {
      global.fetch = jest.fn().mockRejectedValueOnce(new Error('Network error'));

      const result = await useCheckoutStore.getState().tokenizeCard({
        number: '4111111111111111',
        cvc: '123',
        exp_month: '12',
        exp_year: '28',
        card_holder: 'TEST USER',
      });

      expect(result).toBeNull();
      expect(useCheckoutStore.getState().error).toBe('No se pudo procesar la tarjeta. Intenta de nuevo.');
    });

    it('uses default error when messages is truthy but produces empty allErrors and no error.message', async () => {
      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: false,
        status: 422,
        json: async () => ({
          error: {
            messages: {},
          },
        }),
      } as Response);

      const result = await useCheckoutStore.getState().tokenizeCard({
        number: '4111111111111111',
        cvc: '123',
        exp_month: '12',
        exp_year: '28',
        card_holder: 'TEST USER',
      });

      expect(result).toBeNull();
      expect(useCheckoutStore.getState().error).toBe('Error al procesar la tarjeta. Verifica los datos.');
    });

    it('sets error when messages object has empty arrays producing fallback to error.message', async () => {
      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: false,
        status: 422,
        json: async () => ({
          error: {
            messages: {},
            message: 'General error from Wompi',
          },
        }),
      } as Response);

      const result = await useCheckoutStore.getState().tokenizeCard({
        number: '4111111111111111',
        cvc: '123',
        exp_month: '12',
        exp_year: '28',
        card_holder: 'TEST USER',
      });

      expect(result).toBeNull();
      expect(useCheckoutStore.getState().error).toBe('General error from Wompi');
    });
  });

  // ----------------------------------------------------------------
  // fetchPSEBanks
  // ----------------------------------------------------------------
  describe('fetchPSEBanks', () => {
    const originalFetch = global.fetch;

    afterEach(() => {
      global.fetch = originalFetch;
    });

    it('returns empty array when wompi config is missing', async () => {
      useCheckoutStore.setState({ wompiConfig: null });
      const result = await useCheckoutStore.getState().fetchPSEBanks();
      expect(result).toEqual([]);
    });

    it('returns empty array when public key is empty', async () => {
      useCheckoutStore.setState({ wompiConfig: { public_key: '', environment: 'sandbox' } });
      const result = await useCheckoutStore.getState().fetchPSEBanks();
      expect(result).toEqual([]);
    });

    it('fetches banks from sandbox URL', async () => {
      useCheckoutStore.setState({ wompiConfig: MOCK_WOMPI_CONFIG });
      const banks = [
        { financial_institution_code: '1', financial_institution_name: 'Bank A' },
      ];
      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: banks }),
      } as Response);

      const result = await useCheckoutStore.getState().fetchPSEBanks();

      expect(result).toEqual(banks);
      expect(global.fetch).toHaveBeenCalledWith(
        'https://sandbox.wompi.co/v1/pse/financial_institutions',
        expect.objectContaining({
          headers: { Authorization: `Bearer ${MOCK_WOMPI_CONFIG.public_key}` },
        }),
      );
    });

    it('fetches banks from production URL when environment is prod', async () => {
      useCheckoutStore.setState({ wompiConfig: { public_key: 'pub_prod', environment: 'prod' } });
      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [] }),
      } as Response);

      await useCheckoutStore.getState().fetchPSEBanks();

      expect(global.fetch).toHaveBeenCalledWith(
        'https://production.wompi.co/v1/pse/financial_institutions',
        expect.anything(),
      );
    });

    it('returns empty array when response data.data is undefined', async () => {
      useCheckoutStore.setState({ wompiConfig: MOCK_WOMPI_CONFIG });
      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      } as Response);

      const result = await useCheckoutStore.getState().fetchPSEBanks();
      expect(result).toEqual([]);
    });

    it('returns empty array when fetch response is not ok', async () => {
      useCheckoutStore.setState({ wompiConfig: MOCK_WOMPI_CONFIG });
      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: false,
        status: 500,
      } as Response);

      const result = await useCheckoutStore.getState().fetchPSEBanks();
      expect(result).toEqual([]);
    });

    it('returns empty array on network error', async () => {
      useCheckoutStore.setState({ wompiConfig: MOCK_WOMPI_CONFIG });
      global.fetch = jest.fn().mockRejectedValueOnce(new Error('Network'));

      const result = await useCheckoutStore.getState().fetchPSEBanks();
      expect(result).toEqual([]);
    });
  });

  // ----------------------------------------------------------------
  // purchaseWithNequi
  // ----------------------------------------------------------------
  describe('purchaseWithNequi', () => {
    it('creates intent and polls until approved', async () => {
      mockedApi.post.mockResolvedValueOnce({ data: MOCK_INTENT_PENDING });
      mockedApi.get.mockResolvedValueOnce({ data: MOCK_INTENT_APPROVED });

      const promise = useCheckoutStore.getState().purchaseWithNequi(1, '3001234567');
      await jest.advanceTimersByTimeAsync(0);
      expect(useCheckoutStore.getState().paymentStatus).toBe('polling');

      await jest.advanceTimersByTimeAsync(2000);
      const result = await promise;

      expect(result).toBe(true);
      expect(useCheckoutStore.getState().paymentStatus).toBe('success');
    });

    it('sends correct payload with NEQUI payment method', async () => {
      mockedApi.post.mockResolvedValueOnce({ data: MOCK_INTENT_PENDING });
      mockedApi.get.mockResolvedValueOnce({ data: MOCK_INTENT_APPROVED });

      const promise = useCheckoutStore.getState().purchaseWithNequi(1, '3001234567');
      await jest.advanceTimersByTimeAsync(2000);
      await promise;

      expect(mockedApi.post).toHaveBeenCalledWith(
        '/subscriptions/purchase-alternative/',
        { package_id: 1, payment_method: 'NEQUI', phone_number: '3001234567' },
        { headers: { Authorization: 'Bearer fake-token' } },
      );
    });

    it('includes registration token when provided', async () => {
      mockedApi.post.mockResolvedValueOnce({ data: MOCK_INTENT_PENDING });
      mockedApi.get.mockResolvedValueOnce({ data: MOCK_INTENT_APPROVED });

      const promise = useCheckoutStore.getState().purchaseWithNequi(1, '3001234567', 'reg-nequi');
      await jest.advanceTimersByTimeAsync(2000);
      await promise;

      expect(mockedApi.post).toHaveBeenCalledWith(
        '/subscriptions/purchase-alternative/',
        { package_id: 1, payment_method: 'NEQUI', phone_number: '3001234567', registration_token: 'reg-nequi' },
        { headers: { Authorization: 'Bearer fake-token' } },
      );
    });

    it('omits auth header when token is missing', async () => {
      mockedCookies.get.mockReturnValue(undefined);
      mockedApi.post.mockResolvedValueOnce({ data: MOCK_INTENT_PENDING });
      mockedApi.get.mockResolvedValueOnce({ data: MOCK_INTENT_APPROVED });

      const promise = useCheckoutStore.getState().purchaseWithNequi(1, '3001234567');
      await jest.advanceTimersByTimeAsync(2000);
      await promise;

      expect(mockedApi.post).toHaveBeenCalledWith(
        '/subscriptions/purchase-alternative/',
        expect.any(Object),
        undefined,
      );
    });

    it('sets error from API detail on failure', async () => {
      const axiosError = new AxiosError('fail', '400', undefined, undefined, {
        data: { detail: 'Nequi rechazado.' },
        status: 400,
        statusText: 'Bad Request',
        headers: {},
        config: { headers: new AxiosHeaders() },
      });
      mockedApi.post.mockRejectedValueOnce(axiosError);

      const result = await useCheckoutStore.getState().purchaseWithNequi(1, '3001234567');

      expect(result).toBe(false);
      expect(useCheckoutStore.getState().paymentStatus).toBe('error');
      expect(useCheckoutStore.getState().error).toBe('Nequi rechazado.');
    });

    it('uses generic error when no detail in response', async () => {
      mockedApi.post.mockRejectedValueOnce(new Error('Network'));
      const result = await useCheckoutStore.getState().purchaseWithNequi(1, '3001234567');

      expect(result).toBe(false);
      expect(useCheckoutStore.getState().error).toBe('Error al procesar el pago con Nequi.');
    });
  });

  // ----------------------------------------------------------------
  // purchaseWithPSE
  // ----------------------------------------------------------------
  describe('purchaseWithPSE', () => {
    const pseData = {
      financial_institution_code: '1001',
      user_type: 0,
      user_legal_id_type: 'CC',
      user_legal_id: '1234567890',
      full_name: 'Test User',
      phone_number: '573001234567',
    };

    let originalLocation: Location;

    beforeEach(() => {
      originalLocation = window.location;
      Object.defineProperty(window, 'location', {
        writable: true,
        value: { ...originalLocation, href: '' },
      });
    });

    afterEach(() => {
      Object.defineProperty(window, 'location', {
        writable: true,
        value: originalLocation,
      });
    });

    it('redirects when response includes redirect_url', async () => {
      const intentWithRedirect = {
        ...MOCK_INTENT_PENDING,
        redirect_url: 'https://pse.example.com/pay',
      };
      mockedApi.post.mockResolvedValueOnce({ data: intentWithRedirect });

      const result = await useCheckoutStore.getState().purchaseWithPSE(1, pseData);

      expect(result).toBe(true);
      expect(window.location.href).toBe('https://pse.example.com/pay');
      expect(useCheckoutStore.getState().redirectUrl).toBe('https://pse.example.com/pay');
      expect(useCheckoutStore.getState().paymentStatus).toBe('polling');
    });

    it('polls when response has no redirect_url', async () => {
      mockedApi.post.mockResolvedValueOnce({ data: MOCK_INTENT_PENDING });
      mockedApi.get.mockResolvedValueOnce({ data: MOCK_INTENT_APPROVED });

      const promise = useCheckoutStore.getState().purchaseWithPSE(1, pseData);
      await jest.advanceTimersByTimeAsync(2000);
      const result = await promise;

      expect(result).toBe(true);
      expect(useCheckoutStore.getState().paymentStatus).toBe('success');
    });

    it('sends correct payload with PSE payment method', async () => {
      mockedApi.post.mockResolvedValueOnce({ data: MOCK_INTENT_PENDING });
      mockedApi.get.mockResolvedValueOnce({ data: MOCK_INTENT_APPROVED });

      const promise = useCheckoutStore.getState().purchaseWithPSE(1, pseData);
      await jest.advanceTimersByTimeAsync(2000);
      await promise;

      expect(mockedApi.post).toHaveBeenCalledWith(
        '/subscriptions/purchase-alternative/',
        { package_id: 1, payment_method: 'PSE', pse_data: pseData },
        { headers: { Authorization: 'Bearer fake-token' } },
      );
    });

    it('includes registration token when provided', async () => {
      mockedApi.post.mockResolvedValueOnce({ data: MOCK_INTENT_PENDING });
      mockedApi.get.mockResolvedValueOnce({ data: MOCK_INTENT_APPROVED });

      const promise = useCheckoutStore.getState().purchaseWithPSE(1, pseData, 'reg-pse');
      await jest.advanceTimersByTimeAsync(2000);
      await promise;

      expect(mockedApi.post).toHaveBeenCalledWith(
        '/subscriptions/purchase-alternative/',
        { package_id: 1, payment_method: 'PSE', pse_data: pseData, registration_token: 'reg-pse' },
        { headers: { Authorization: 'Bearer fake-token' } },
      );
    });

    it('omits auth header when token is missing', async () => {
      mockedCookies.get.mockReturnValue(undefined);
      mockedApi.post.mockResolvedValueOnce({ data: MOCK_INTENT_PENDING });
      mockedApi.get.mockResolvedValueOnce({ data: MOCK_INTENT_APPROVED });

      const promise = useCheckoutStore.getState().purchaseWithPSE(1, pseData);
      await jest.advanceTimersByTimeAsync(2000);
      await promise;

      expect(mockedApi.post).toHaveBeenCalledWith(
        '/subscriptions/purchase-alternative/',
        expect.any(Object),
        undefined,
      );
    });

    it('sets error from API detail on failure', async () => {
      const axiosError = new AxiosError('fail', '400', undefined, undefined, {
        data: { detail: 'PSE rechazado.' },
        status: 400,
        statusText: 'Bad Request',
        headers: {},
        config: { headers: new AxiosHeaders() },
      });
      mockedApi.post.mockRejectedValueOnce(axiosError);

      const result = await useCheckoutStore.getState().purchaseWithPSE(1, pseData);

      expect(result).toBe(false);
      expect(useCheckoutStore.getState().error).toBe('PSE rechazado.');
    });

    it('uses generic error when no detail in response', async () => {
      mockedApi.post.mockRejectedValueOnce(new Error('Network'));
      const result = await useCheckoutStore.getState().purchaseWithPSE(1, pseData);

      expect(result).toBe(false);
      expect(useCheckoutStore.getState().error).toBe('Error al procesar el pago con PSE.');
    });
  });

  // ----------------------------------------------------------------
  // purchaseWithBancolombia
  // ----------------------------------------------------------------
  describe('purchaseWithBancolombia', () => {
    let originalLocation: Location;

    beforeEach(() => {
      originalLocation = window.location;
      Object.defineProperty(window, 'location', {
        writable: true,
        value: { ...originalLocation, href: '' },
      });
    });

    afterEach(() => {
      Object.defineProperty(window, 'location', {
        writable: true,
        value: originalLocation,
      });
    });

    it('redirects when response includes redirect_url', async () => {
      const intentWithRedirect = {
        ...MOCK_INTENT_PENDING,
        redirect_url: 'https://bancolombia.example.com/pay',
      };
      mockedApi.post.mockResolvedValueOnce({ data: intentWithRedirect });

      const result = await useCheckoutStore.getState().purchaseWithBancolombia(1);

      expect(result).toBe(true);
      expect(window.location.href).toBe('https://bancolombia.example.com/pay');
      expect(useCheckoutStore.getState().redirectUrl).toBe('https://bancolombia.example.com/pay');
    });

    it('polls when response has no redirect_url', async () => {
      mockedApi.post.mockResolvedValueOnce({ data: MOCK_INTENT_PENDING });
      mockedApi.get.mockResolvedValueOnce({ data: MOCK_INTENT_APPROVED });

      const promise = useCheckoutStore.getState().purchaseWithBancolombia(1);
      await jest.advanceTimersByTimeAsync(2000);
      const result = await promise;

      expect(result).toBe(true);
      expect(useCheckoutStore.getState().paymentStatus).toBe('success');
    });

    it('sends correct payload with BANCOLOMBIA_TRANSFER method', async () => {
      mockedApi.post.mockResolvedValueOnce({ data: MOCK_INTENT_PENDING });
      mockedApi.get.mockResolvedValueOnce({ data: MOCK_INTENT_APPROVED });

      const promise = useCheckoutStore.getState().purchaseWithBancolombia(1);
      await jest.advanceTimersByTimeAsync(2000);
      await promise;

      expect(mockedApi.post).toHaveBeenCalledWith(
        '/subscriptions/purchase-alternative/',
        { package_id: 1, payment_method: 'BANCOLOMBIA_TRANSFER' },
        { headers: { Authorization: 'Bearer fake-token' } },
      );
    });

    it('includes registration token when provided', async () => {
      mockedApi.post.mockResolvedValueOnce({ data: MOCK_INTENT_PENDING });
      mockedApi.get.mockResolvedValueOnce({ data: MOCK_INTENT_APPROVED });

      const promise = useCheckoutStore.getState().purchaseWithBancolombia(1, 'reg-banco');
      await jest.advanceTimersByTimeAsync(2000);
      await promise;

      expect(mockedApi.post).toHaveBeenCalledWith(
        '/subscriptions/purchase-alternative/',
        { package_id: 1, payment_method: 'BANCOLOMBIA_TRANSFER', registration_token: 'reg-banco' },
        { headers: { Authorization: 'Bearer fake-token' } },
      );
    });

    it('omits auth header when token is missing', async () => {
      mockedCookies.get.mockReturnValue(undefined);
      mockedApi.post.mockResolvedValueOnce({ data: MOCK_INTENT_PENDING });
      mockedApi.get.mockResolvedValueOnce({ data: MOCK_INTENT_APPROVED });

      const promise = useCheckoutStore.getState().purchaseWithBancolombia(1);
      await jest.advanceTimersByTimeAsync(2000);
      await promise;

      expect(mockedApi.post).toHaveBeenCalledWith(
        '/subscriptions/purchase-alternative/',
        expect.any(Object),
        undefined,
      );
    });

    it('sets error from API detail on failure', async () => {
      const axiosError = new AxiosError('fail', '400', undefined, undefined, {
        data: { detail: 'Bancolombia rechazado.' },
        status: 400,
        statusText: 'Bad Request',
        headers: {},
        config: { headers: new AxiosHeaders() },
      });
      mockedApi.post.mockRejectedValueOnce(axiosError);

      const result = await useCheckoutStore.getState().purchaseWithBancolombia(1);

      expect(result).toBe(false);
      expect(useCheckoutStore.getState().error).toBe('Bancolombia rechazado.');
    });

    it('uses generic error when no detail in response', async () => {
      mockedApi.post.mockRejectedValueOnce(new Error('Network'));
      const result = await useCheckoutStore.getState().purchaseWithBancolombia(1);

      expect(result).toBe(false);
      expect(useCheckoutStore.getState().error).toBe('Error al procesar el pago con Bancolombia.');
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
