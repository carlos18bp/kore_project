import { render, screen } from '@testing-library/react';
import AdminSubscriptionNewPage from '@/app/admin-platform/subscriptions/new/page';
import { useAdminUserStore } from '@/lib/stores/adminUserStore';
import { useAdminSubscriptionStore } from '@/lib/stores/adminSubscriptionStore';
import { api } from '@/lib/services/http';

let customerParam: string | null = null;

const mockUsePathname = jest.fn();
jest.mock('next/navigation', () => ({
  usePathname: () => mockUsePathname(),
  useRouter: () => ({ push: jest.fn(), back: jest.fn() }),
  useSearchParams: () => ({ get: () => customerParam }),
}));

jest.mock('next/link', () => {
  const MockLink = ({
    href,
    children,
    ...props
  }: {
    href: string;
    children: React.ReactNode;
    [key: string]: unknown;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  );
  MockLink.displayName = 'MockLink';
  return MockLink;
});

jest.mock('js-cookie', () => ({
  get: jest.fn(() => 'token'),
  set: jest.fn(),
  remove: jest.fn(),
}));

const mockUser = {
  id: '1',
  email: 'admin@example.com',
  first_name: 'Ana',
  last_name: 'García',
  role: 'ADMIN',
  name: 'Ana García',
};

jest.mock('@/lib/stores/authStore', () => ({
  useAuthStore: (selector?: (state: { user: typeof mockUser; logout: () => void }) => unknown) => {
    const state = { user: mockUser, logout: jest.fn() };
    return typeof selector === 'function' ? selector(state) : state;
  },
}));

jest.mock('@/lib/services/http', () => ({
  api: { get: jest.fn() },
}));

jest.mock('@/lib/stores/adminUserStore', () => ({
  useAdminUserStore: jest.fn(),
}));

jest.mock('@/lib/stores/adminSubscriptionStore', () => ({
  useAdminSubscriptionStore: jest.fn(),
}));

const mockedUserStore = useAdminUserStore as unknown as jest.Mock;
const mockedSubStore = useAdminSubscriptionStore as unknown as jest.Mock;
const mockedApiGet = api.get as unknown as jest.Mock;
const mockFetchUserById = jest.fn();
const mockFetchUsers = jest.fn();
const mockCreateOrEvolve = jest.fn();

const activePackage = {
  id: 1,
  title: 'Plan Personalizado Base',
  category: 'personalizado',
  sessions_count: 8,
  session_duration_minutes: 60,
  price: '400000',
  currency: 'COP',
  validity_days: 30,
  is_active: true,
};

function setUserStore(overrides: Record<string, unknown> = {}) {
  mockedUserStore.mockReturnValue({
    selected: null,
    fetchById: mockFetchUserById,
    fetchUsers: mockFetchUsers,
    users: [],
    ...overrides,
  });
}

function setSubStore(overrides: Record<string, unknown> = {}) {
  mockedSubStore.mockReturnValue({
    createOrEvolveSubscription: mockCreateOrEvolve,
    actionLoading: false,
    ...overrides,
  });
}

beforeEach(() => {
  customerParam = null;
  mockUsePathname.mockReturnValue('/admin-platform/subscriptions/new');
  mockedApiGet.mockResolvedValue({ data: { results: [activePackage], next: null } });
  setUserStore();
  setSubStore();
});

afterEach(() => {
  jest.clearAllMocks();
});

describe('AdminSubscriptionNewPage', () => {
  it('renders the create subscription heading', () => {
    render(<AdminSubscriptionNewPage />);
    expect(
      screen.getByRole('heading', { name: 'Crear / Evolucionar suscripción' }),
    ).toBeInTheDocument();
  });

  it('renders the customer picker when no customer is preselected', () => {
    render(<AdminSubscriptionNewPage />);
    expect(screen.getByText('Selecciona el cliente')).toBeInTheDocument();
  });

  it('lists eligible customers without an active subscription in the picker', () => {
    setUserStore({
      users: [
        { id: 10, full_name: 'Laura Díaz', email: 'laura@example.com', has_active_subscription: false },
      ],
    });
    render(<AdminSubscriptionNewPage />);
    expect(screen.getByText('Laura Díaz')).toBeInTheDocument();
  });

  it('renders the selected customer block when a customer is preselected', () => {
    customerParam = '100';
    setUserStore({
      selected: {
        id: 100,
        full_name: 'Carlos López',
        email: 'carlos@example.com',
        subscriptions: [],
      },
    });
    render(<AdminSubscriptionNewPage />);
    expect(screen.getAllByText('Carlos López').length).toBeGreaterThan(0);
    expect(screen.getByText('Sin suscripción activa.')).toBeInTheDocument();
  });

  it('renders an active package option once packages finish loading', async () => {
    customerParam = '100';
    setUserStore({
      selected: { id: 100, full_name: 'Carlos López', email: 'carlos@example.com', subscriptions: [] },
    });
    render(<AdminSubscriptionNewPage />);
    expect(await screen.findByText('Plan Personalizado Base')).toBeInTheDocument();
  });

  it('renders the package error state when the packages request fails', async () => {
    customerParam = '100';
    mockedApiGet.mockRejectedValue(new Error('network'));
    setUserStore({
      selected: { id: 100, full_name: 'Carlos López', email: 'carlos@example.com', subscriptions: [] },
    });
    render(<AdminSubscriptionNewPage />);
    expect(await screen.findByText('No se pudieron cargar los paquetes.')).toBeInTheDocument();
  });
});
