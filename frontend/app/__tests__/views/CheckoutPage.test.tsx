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
    useAuthStore.setState({
      user: { id: '1', email: 'test@kore.com', first_name: 'Test', last_name: 'User', phone: '', role: 'customer', name: 'Test User' },
      accessToken: 'fake-token',
      isAuthenticated: true,
    });
    useCheckoutStore.setState({
      package_: null,
      wompiConfig: null,
      loading: false,
      paymentStatus: 'idle',
      purchaseResult: null,
      error: '',
    });
  });

  it('redirects to register if not authenticated', () => {
    useAuthStore.setState({ user: null, accessToken: null, isAuthenticated: false });
    render(<CheckoutPage />);
    expect(mockPush).toHaveBeenCalledWith('/register?package=1');
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
    useCheckoutStore.setState({
      loading: false,
      package_: MOCK_PACKAGE,
      wompiConfig: MOCK_WOMPI_CONFIG,
      paymentStatus: 'success',
      purchaseResult: {
        id: 99,
        status: 'active',
        sessions_total: 10,
        starts_at: '2025-01-01T00:00:00Z',
        expires_at: '2025-01-31T00:00:00Z',
        next_billing_date: '2025-01-31',
      },
    });
    render(<CheckoutPage />);

    expect(screen.getByText('¡Pago exitoso!')).toBeInTheDocument();
    expect(screen.getByText('Tu suscripción ha sido activada')).toBeInTheDocument();
    expect(screen.getByText('Semi Presencial FLW')).toBeInTheDocument();
    expect(screen.getByText('10')).toBeInTheDocument();
    expect(screen.getByText('2025-01-31')).toBeInTheDocument();
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
    expect(screen.getByText('← Volver a programas').closest('a')).toHaveAttribute('href', '/programas');
  });

  it('renders brand name KÓRE', () => {
    render(<CheckoutPage />);
    expect(screen.getByText('KÓRE')).toBeInTheDocument();
  });

  it('shows recurring charge info', async () => {
    render(<CheckoutPage />);
    await waitFor(() => {
      expect(screen.getByText('Se cobrará automáticamente cada 30 días')).toBeInTheDocument();
    });
  });
});
