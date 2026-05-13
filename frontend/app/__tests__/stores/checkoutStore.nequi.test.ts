/**
 * Tests for the NEQUI subscription flow in checkoutStore.
 * Verifies the two-step Wompi-aligned flow: start (tokenize phone) → confirm
 * (poll token + create payment_source + recurring transaction).
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

describe('checkoutStore.purchaseWithNequi', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetStore();
    mockedCookies.get.mockReturnValue('fake-jwt' as never);
  });

  it('calls /nequi/start/ then /nequi/confirm/ with the returned reference', async () => {
    mockedApi.post
      .mockResolvedValueOnce({
        data: {
          id: 1,
          reference: 'kore-nq-001',
          wompi_transaction_id: '',
          status: 'pending',
          amount: '120000',
          currency: 'COP',
          package_title: 'Bronze',
          nequi_token_id: 'nequi_tok_xyz',
          await_user_approval: true,
        },
      })
      .mockResolvedValueOnce({
        data: {
          id: 1,
          reference: 'kore-nq-001',
          wompi_transaction_id: 'txn-rec-001',
          status: 'pending',
          amount: '120000',
          currency: 'COP',
          package_title: 'Bronze',
        },
      })
      .mockResolvedValue({ data: {} });
    // After confirm, pollIntentStatus uses api.get
    mockedApi.get.mockResolvedValue({
      data: {
        id: 1,
        reference: 'kore-nq-001',
        wompi_transaction_id: 'txn-rec-001',
        status: 'approved',
        amount: '120000',
        currency: 'COP',
        package_title: 'Bronze',
      },
    });

    const ok = await useCheckoutStore.getState().purchaseWithNequi(7, '3001112233');
    expect(ok).toBe(true);

    const startCall = mockedApi.post.mock.calls[0];
    expect(startCall[0]).toBe('/subscriptions/nequi/start/');
    expect(startCall[1]).toMatchObject({ package_id: 7, phone_number: '3001112233' });

    const confirmCall = mockedApi.post.mock.calls[1];
    expect(confirmCall[0]).toBe('/subscriptions/nequi/confirm/');
    expect(confirmCall[1]).toMatchObject({ reference: 'kore-nq-001' });
  });

  it('forwards a registration_token for guest checkout on start', async () => {
    mockedCookies.get.mockReturnValue(undefined as never);
    mockedApi.post
      .mockResolvedValueOnce({
        data: {
          id: 2,
          reference: 'kore-nq-guest',
          wompi_transaction_id: '',
          status: 'pending',
          amount: '120000',
          currency: 'COP',
          package_title: 'Bronze',
          checkout_access_token: 'public-access-abc',
          nequi_token_id: 'nequi_tok_g',
          await_user_approval: true,
        },
      })
      .mockResolvedValueOnce({
        data: {
          id: 2,
          reference: 'kore-nq-guest',
          wompi_transaction_id: 'txn-g',
          status: 'pending',
          amount: '120000',
          currency: 'COP',
          package_title: 'Bronze',
          checkout_access_token: 'public-access-abc',
        },
      });
    mockedApi.get.mockResolvedValue({
      data: {
        id: 2,
        reference: 'kore-nq-guest',
        wompi_transaction_id: 'txn-g',
        status: 'approved',
        amount: '120000',
        currency: 'COP',
        package_title: 'Bronze',
      },
    });

    await useCheckoutStore.getState().purchaseWithNequi(7, '3001112233', 'signed-reg-token');

    expect(mockedApi.post.mock.calls[0][1]).toMatchObject({
      package_id: 7,
      phone_number: '3001112233',
      registration_token: 'signed-reg-token',
    });
    // Guest confirm must forward the public access token from the start response
    expect(mockedApi.post.mock.calls[1][1]).toMatchObject({
      reference: 'kore-nq-guest',
      access_token: 'public-access-abc',
    });
  });
});
