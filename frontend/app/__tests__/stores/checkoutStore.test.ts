import Cookies from 'js-cookie';
import { useCheckoutStore } from '@/lib/stores/checkoutStore';
import { api } from '@/lib/services/http';
import { AxiosError, AxiosHeaders } from 'axios';

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

const MOCK_PURCHASE_RESULT = {
  id: 10,
  status: 'active',
  sessions_total: 12,
  starts_at: '2025-02-15T00:00:00Z',
  expires_at: '2025-03-15T00:00:00Z',
  next_billing_date: null,
};

function resetStore() {
  useCheckoutStore.setState({
    package_: null,
    wompiConfig: null,
    loading: false,
    paymentStatus: 'idle',
    purchaseResult: null,
    error: '',
  });
}

describe('checkoutStore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetStore();
    mockedCookies.get.mockReturnValue('fake-token');
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

    it('sets error on failure', async () => {
      mockedApi.get.mockRejectedValueOnce(new Error('fail'));
      await useCheckoutStore.getState().fetchWompiConfig();
      expect(useCheckoutStore.getState().error).toBe('No se pudo cargar la configuración de pago.');
    });
  });

  // ----------------------------------------------------------------
  // purchaseSubscription
  // ----------------------------------------------------------------
  describe('purchaseSubscription', () => {
    it('sets paymentStatus to success and returns true on success', async () => {
      mockedApi.post.mockResolvedValueOnce({ data: MOCK_PURCHASE_RESULT });
      const result = await useCheckoutStore.getState().purchaseSubscription(1, 'card-token-abc');
      expect(result).toBe(true);
      const state = useCheckoutStore.getState();
      expect(state.paymentStatus).toBe('success');
      expect(state.purchaseResult).toEqual(MOCK_PURCHASE_RESULT);
    });

    it('sends correct payload with auth header', async () => {
      mockedApi.post.mockResolvedValueOnce({ data: MOCK_PURCHASE_RESULT });
      await useCheckoutStore.getState().purchaseSubscription(1, 'card-token-abc');
      expect(mockedApi.post).toHaveBeenCalledWith(
        '/subscriptions/purchase/',
        { package_id: 1, card_token: 'card-token-abc' },
        { headers: { Authorization: 'Bearer fake-token' } },
      );
    });

    it('sets error from API detail on failure', async () => {
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
  // reset
  // ----------------------------------------------------------------
  describe('reset', () => {
    it('resets all state to initial values', () => {
      useCheckoutStore.setState({
        package_: MOCK_PACKAGE,
        wompiConfig: MOCK_WOMPI_CONFIG,
        loading: true,
        paymentStatus: 'success',
        purchaseResult: MOCK_PURCHASE_RESULT,
        error: 'some error',
      });

      useCheckoutStore.getState().reset();
      const state = useCheckoutStore.getState();
      expect(state.package_).toBeNull();
      expect(state.wompiConfig).toBeNull();
      expect(state.loading).toBe(false);
      expect(state.paymentStatus).toBe('idle');
      expect(state.purchaseResult).toBeNull();
      expect(state.error).toBe('');
    });
  });
});
