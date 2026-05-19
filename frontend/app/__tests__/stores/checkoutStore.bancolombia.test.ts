/**
 * Tests for the BANCOLOMBIA_TRANSFER subscription flow in checkoutStore.
 * Verifies the Wompi-aligned tokenization flow: start (create token, return
 * authorization_url) and confirm (poll token + create payment_source + txn).
 */
import Cookies from 'js-cookie';
import { useCheckoutStore } from '@/lib/stores/checkoutStore';
import { api } from '@/lib/services/http';

jest.mock('js-cookie', () => ({
  get: jest.fn(),
  set: jest.fn(),
  remove: jest.fn(),
}));

jest.mock('@/lib/services/http', () => ({
  api: { post: jest.fn(), get: jest.fn() },
}));

const mockedApi = api as jest.Mocked<typeof api>;
const mockedCookies = Cookies as jest.Mocked<typeof Cookies>;

function resetStore() {
  useCheckoutStore.setState({
    package_: null,
    wompiConfig: null,
    loading: false,
    paymentStatus: 'idle',
    intentResult: null,
    redirectUrl: null,
    error: '',
    termsAccepted: false,
    termsLoading: false,
  });
}

describe('checkoutStore.startBancolombiaPurchase', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetStore();
    mockedCookies.get.mockReturnValue('fake-jwt' as never);
  });

  it('returns the authorization_url from /bancolombia/start/', async () => {
    mockedApi.post.mockResolvedValueOnce({
      data: {
        id: 10,
        reference: 'kore-bcol-001',
        wompi_transaction_id: '',
        status: 'pending',
        amount: '240000',
        currency: 'COP',
        package_title: 'Silver',
        authorization_url: 'https://sucursal.bancolombia.com/auth/abc',
      },
    });

    const result = await useCheckoutStore.getState().startBancolombiaPurchase(
      7,
      'https://kore.app/checkout?package=7&bancolombia_callback=1',
    );

    expect(result).not.toBeNull();
    expect(result!.authorization_url).toBe('https://sucursal.bancolombia.com/auth/abc');
    expect(result!.reference).toBe('kore-bcol-001');

    const call = mockedApi.post.mock.calls[0];
    expect(call[0]).toBe('/subscriptions/bancolombia/start/');
    expect(call[1]).toMatchObject({
      package_id: 7,
      redirect_url: 'https://kore.app/checkout?package=7&bancolombia_callback=1',
    });
  });

  it('returns null and sets an error message on start failure', async () => {
    mockedApi.post.mockRejectedValueOnce({
      response: { data: { detail: 'No se pudo iniciar.' } },
      isAxiosError: true,
    });

    const result = await useCheckoutStore.getState().startBancolombiaPurchase(
      7,
      'https://kore.app/checkout',
    );
    expect(result).toBeNull();
    expect(useCheckoutStore.getState().paymentStatus).toBe('error');
    expect(useCheckoutStore.getState().error).toBe('No se pudo iniciar.');
  });
});

describe('checkoutStore.confirmBancolombiaPurchase', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetStore();
    mockedCookies.get.mockReturnValue('fake-jwt' as never);
  });

  it('posts to /bancolombia/confirm/ and polls intent status to approved', async () => {
    mockedApi.post.mockResolvedValueOnce({
      data: {
        id: 10,
        reference: 'kore-bcol-002',
        wompi_transaction_id: 'txn-bcol',
        status: 'pending',
        amount: '240000',
        currency: 'COP',
        package_title: 'Silver',
      },
    });
    mockedApi.get.mockResolvedValue({
      data: {
        id: 10,
        reference: 'kore-bcol-002',
        wompi_transaction_id: 'txn-bcol',
        status: 'approved',
        amount: '240000',
        currency: 'COP',
        package_title: 'Silver',
      },
    });

    const ok = await useCheckoutStore.getState().confirmBancolombiaPurchase('kore-bcol-002');
    expect(ok).toBe(true);
    const call = mockedApi.post.mock.calls[0];
    expect(call[0]).toBe('/subscriptions/bancolombia/confirm/');
    expect(call[1]).toMatchObject({ reference: 'kore-bcol-002' });
  });

  it('forwards a public access_token on guest confirm', async () => {
    mockedCookies.get.mockReturnValue(undefined as never);
    mockedApi.post.mockResolvedValueOnce({
      data: {
        id: 11,
        reference: 'kore-bcol-guest',
        wompi_transaction_id: 'txn-guest',
        status: 'pending',
        amount: '240000',
        currency: 'COP',
        package_title: 'Silver',
        checkout_access_token: 'public-access',
      },
    });
    mockedApi.get.mockResolvedValue({
      data: {
        id: 11,
        reference: 'kore-bcol-guest',
        wompi_transaction_id: 'txn-guest',
        status: 'approved',
        amount: '240000',
        currency: 'COP',
        package_title: 'Silver',
        checkout_access_token: 'public-access',
      },
    });

    await useCheckoutStore.getState().confirmBancolombiaPurchase('kore-bcol-guest', 'public-access');
    expect(mockedApi.post.mock.calls[0][1]).toMatchObject({
      reference: 'kore-bcol-guest',
      access_token: 'public-access',
    });
  });
});
