import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CheckoutPage from '@/app/(public)/checkout/page';
import { useAuthStore } from '@/lib/stores/authStore';
import { useCheckoutStore } from '@/lib/stores/checkoutStore';
import { api } from '@/lib/services/http';

const mockPush = jest.fn();
const mockGet = jest.fn().mockReturnValue('1');

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  useSearchParams: () => ({
    get: mockGet,
  }),
}));

jest.mock('next/image', () => ({
  __esModule: true,
  default: (props: React.ImgHTMLAttributes<HTMLImageElement>) => <img {...props} />,
}));

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href, ...rest }: { children: React.ReactNode; href: string }) => (
    <a href={href} {...rest}>{children}</a>
  ),
}));

jest.mock('js-cookie', () => ({
  get: jest.fn().mockReturnValue('fake-token'),
  set: jest.fn(),
  remove: jest.fn(),
}));

jest.mock('@/lib/services/http', () => ({
  api: { get: jest.fn(), post: jest.fn() },
}));

const mockedApi = api as jest.Mocked<typeof api>;

const MOCK_PACKAGE = {
  id: 1,
  title: 'Semi Presencial FLW',
  description: 'Un programa semi presencial',
  sessions_count: 10,
  price: '300000.00',
  currency: 'COP',
  validity_days: 30,
  is_active: true,
};

const MOCK_WOMPI_CONFIG = {
  public_key: 'pub_test_abc123',
  environment: 'test',
};

const MOCK_CHECKOUT_PREPARATION = {
  reference: 'ref-checkout-001',
  signature: 'sig-checkout-001',
  amount_in_cents: 30000000,
  currency: 'COP',
  package_title: 'Semi Presencial FLW',
};

describe('CheckoutPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGet.mockReturnValue('1');
    // Mock API responses for fetchPackage and fetchWompiConfig called by useEffect
    mockedApi.get.mockImplementation((url: string) => {
      if (url.includes('/packages/')) return Promise.resolve({ data: MOCK_PACKAGE });
      if (url.includes('/wompi/config')) return Promise.resolve({ data: MOCK_WOMPI_CONFIG });
      return Promise.reject(new Error('unexpected url'));
    });
    mockedApi.post.mockResolvedValue({ data: MOCK_CHECKOUT_PREPARATION });
    useAuthStore.setState({
      user: { id: '1', email: 'test@kore.com', first_name: 'Test', last_name: 'User', phone: '', role: 'customer', name: 'Test User' },
      accessToken: 'fake-token',
      isAuthenticated: true,
      hydrated: true,
    });
    useCheckoutStore.setState({
      package_: null,
      wompiConfig: null,
      loading: false,
      paymentStatus: 'idle',
      intentResult: null,
      error: '',
    });
  });

  afterEach(() => {
    const existingScript = document.getElementById('wompi-widget-script');
    existingScript?.remove();
    delete window.WidgetCheckout;
  });

  it('redirects to register if not authenticated', () => {
    useAuthStore.setState({ user: null, accessToken: null, isAuthenticated: false, hydrated: true });
    render(<CheckoutPage />);
    expect(mockPush).toHaveBeenCalledWith('/register?package=1');
  });

  it('allows guest checkout when registration token exists for package', async () => {
    useAuthStore.setState({ user: null, accessToken: null, isAuthenticated: false, hydrated: true });
    window.sessionStorage.setItem('kore_checkout_registration_token', 'signed-token-abc');
    window.sessionStorage.setItem('kore_checkout_registration_package', '1');

    render(<CheckoutPage />);

    await waitFor(() => {
      expect(screen.getByText('Resumen del programa')).toBeInTheDocument();
    });
    expect(mockPush).not.toHaveBeenCalledWith('/register?package=1');
  });

  it('shows package not found when API returns error', async () => {
    mockedApi.get.mockImplementation((url: string) => {
      if (url.includes('/packages/')) return Promise.reject(new Error('not found'));
      if (url.includes('/wompi/config')) return Promise.resolve({ data: MOCK_WOMPI_CONFIG });
      return Promise.reject(new Error('unexpected url'));
    });
    render(<CheckoutPage />);
    await waitFor(() => {
      expect(screen.getByText('No se pudo cargar el paquete.')).toBeInTheDocument();
    });
  });

  it('renders package summary after data loads', async () => {
    render(<CheckoutPage />);
    await waitFor(() => {
      expect(screen.getByText('Resumen del programa')).toBeInTheDocument();
    });
    expect(screen.getByText('Semi Presencial FLW')).toBeInTheDocument();
    expect(screen.getByText('10')).toBeInTheDocument();
    expect(screen.getByText('30 días')).toBeInTheDocument();
  });

  it('renders pay button after data loads', async () => {
    render(<CheckoutPage />);
    await waitFor(() => {
      expect(screen.getByRole('button')).toBeInTheDocument();
    });
  });

  it('initializes widget with checkout parameters', async () => {
    const open = jest.fn();
    const widgetCheckoutMock = jest.fn().mockImplementation(() => ({ open }));
    window.WidgetCheckout = widgetCheckoutMock;

    const script = document.createElement('script');
    script.id = 'wompi-widget-script';
    document.body.appendChild(script);

    render(<CheckoutPage />);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Pagar/ })).toBeEnabled();
    });

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /Pagar/ }));

    expect(widgetCheckoutMock).toHaveBeenCalledTimes(1);
    const config = widgetCheckoutMock.mock.calls[0][0] as Record<string, unknown>;
    expect(config.currency).toBe('COP');
    expect(config.amountInCents).toBe(30000000);
    expect(config.reference).toBe('ref-checkout-001');
    expect(config.signature).toEqual({ integrity: 'sig-checkout-001' });
    expect(config.collectCustomerLegalId).toBeUndefined();
    expect(config['customer-data:email']).toBeUndefined();
    expect(config['customer-data:full-name']).toBeUndefined();
    expect(open).toHaveBeenCalledTimes(1);
  });

  it('shows error when widget callback does not return a transaction id', async () => {
    const open = jest.fn();
    const widgetCheckoutMock = jest.fn().mockImplementation(() => ({ open }));
    window.WidgetCheckout = widgetCheckoutMock;

    const script = document.createElement('script');
    script.id = 'wompi-widget-script';
    document.body.appendChild(script);

    render(<CheckoutPage />);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Pagar/ })).toBeEnabled();
    });

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /Pagar/ }));

    expect(open).toHaveBeenCalledTimes(1);
    const callback = open.mock.calls[0][0] as (result: { transaction?: { id?: string } }) => Promise<void>;
    await callback({});

    expect(useCheckoutStore.getState().paymentStatus).toBe('error');
    expect(useCheckoutStore.getState().error).toBe('No se pudo completar el pago. Intenta de nuevo.');
  });

  it('shows processing state when payment is in progress', async () => {
    render(<CheckoutPage />);
    await waitFor(() => {
      expect(screen.getByText('Resumen del programa')).toBeInTheDocument();
    });
    useCheckoutStore.setState({ paymentStatus: 'processing' });
    await waitFor(() => {
      expect(screen.getByText('Procesando pago...')).toBeInTheDocument();
    });
  });

  it('shows success screen with purchase details', () => {
    mockGet.mockReturnValue(null);
    useAuthStore.setState({
      user: { id: '1', email: 'test@kore.com', first_name: 'Test', last_name: 'User', phone: '', role: 'customer', name: 'Test User' },
      accessToken: 'fake-token',
      isAuthenticated: true,
      hydrated: true,
    });
    useCheckoutStore.setState({
      loading: false,
      package_: MOCK_PACKAGE,
      wompiConfig: MOCK_WOMPI_CONFIG,
      paymentStatus: 'success',
      intentResult: {
        id: 99,
        reference: 'ref-success-001',
        wompi_transaction_id: 'txn-success-001',
        status: 'approved',
        amount: '300000.00',
        currency: 'COP',
        package_title: 'Semi Presencial FLW',
        created_at: '2025-01-01T00:00:00Z',
      },
    });
    render(<CheckoutPage />);

    expect(screen.getByText('¡Pago exitoso!')).toBeInTheDocument();
    expect(screen.getByText('Tu suscripción ha sido activada')).toBeInTheDocument();
    expect(screen.getByText('Semi Presencial FLW')).toBeInTheDocument();
    expect(screen.getByText('10')).toBeInTheDocument();
    expect(screen.getByText('Ir a mi dashboard')).toHaveAttribute('href', '/dashboard');
  });

  it('shows error in checkout when payment fails', async () => {
    render(<CheckoutPage />);
    await waitFor(() => {
      expect(screen.getByText('Resumen del programa')).toBeInTheDocument();
    });
    useCheckoutStore.setState({
      paymentStatus: 'error',
      error: 'Error al procesar el pago. Intenta de nuevo.',
    });
    await waitFor(() => {
      expect(screen.getByText('Error al procesar el pago. Intenta de nuevo.')).toBeInTheDocument();
    });
  });

  it('renders back link to programas', async () => {
    render(<CheckoutPage />);
    await waitFor(() => {
      expect(screen.getByText('← Volver a programas')).toBeInTheDocument();
    });
    expect(screen.getByText('← Volver a programas').closest('a')).toHaveAttribute('href', '/programs');
  });

  it('renders brand name KÓRE', () => {
    render(<CheckoutPage />);
    expect(screen.getByText('KÓRE')).toBeInTheDocument();
  });

  it('shows recurring charge info', async () => {
    render(<CheckoutPage />);
    await waitFor(() => {
      expect(
        screen.getByText('El cobro automático aplica solo con tarjeta. Con otros métodos, deberás renovar manualmente cada 30 días.'),
      ).toBeInTheDocument();
    });
  });

  it('shows payment methods with recurring and non-recurring distinction', async () => {
    render(<CheckoutPage />);
    await waitFor(() => {
      expect(
        screen.getByText('Métodos disponibles: Tarjeta (recurrente), Nequi, PSE y Bancolombia Transfer (no recurrentes).'),
      ).toBeInTheDocument();
    });
  });
});
