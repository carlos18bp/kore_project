import { render, screen, fireEvent } from '@testing-library/react';
import AdminUserDetailPage from '@/app/admin-platform/users/detail/page';
import { useAdminUserStore } from '@/lib/stores/adminUserStore';

const mockPush = jest.fn();
const mockUsePathname = jest.fn();
jest.mock('next/navigation', () => ({
  usePathname: () => mockUsePathname(),
  useRouter: () => ({ push: mockPush }),
  useSearchParams: () => ({ get: () => '5' }),
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

const mockFetchTrainers = jest.fn();
jest.mock('@/lib/stores/bookingStore', () => {
  const hook = () => ({ trainers: [] });
  hook.getState = () => ({ fetchTrainers: mockFetchTrainers });
  return { useBookingStore: hook };
});

jest.mock('@/lib/stores/adminUserStore', () => ({
  useAdminUserStore: jest.fn(),
}));

const mockedStore = useAdminUserStore as unknown as jest.Mock;
const mockFetchById = jest.fn();
const mockPatchUser = jest.fn();
const mockResetUserPassword = jest.fn();
const mockToggleActive = jest.fn();
const mockDeleteUser = jest.fn();
const mockAssignTrainer = jest.fn();

function makeDetail(overrides: Record<string, unknown> = {}) {
  return {
    id: 5,
    email: 'carlos@example.com',
    first_name: 'Carlos',
    last_name: 'López',
    full_name: 'Carlos López',
    phone: '',
    role: 'customer',
    is_active: true,
    must_change_password: false,
    date_joined: '2026-01-01T00:00:00Z',
    last_login: null,
    has_active_subscription: false,
    sessions_used_total: 0,
    sessions_total_total: 0,
    subscriptions: [],
    assigned_trainer: null,
    assigned_clients: null,
    ...overrides,
  };
}

function setStore(overrides: Record<string, unknown> = {}) {
  mockedStore.mockReturnValue({
    selected: makeDetail(),
    loading: false,
    actionLoading: false,
    error: '',
    fetchById: mockFetchById,
    patchUser: mockPatchUser,
    resetUserPassword: mockResetUserPassword,
    toggleActive: mockToggleActive,
    deleteUser: mockDeleteUser,
    assignTrainer: mockAssignTrainer,
    ...overrides,
  });
}

beforeEach(() => {
  mockUsePathname.mockReturnValue('/admin-platform/users/detail');
  setStore();
});

afterEach(() => {
  jest.clearAllMocks();
});

describe('AdminUserDetailPage', () => {
  it('fetches the user by id on mount', () => {
    render(<AdminUserDetailPage />);
    expect(mockFetchById).toHaveBeenCalledWith(5);
  });

  it('renders the loading state when no user is selected', () => {
    setStore({ selected: null, loading: true });
    render(<AdminUserDetailPage />);
    expect(screen.getByRole('heading', { name: 'Cargando…' })).toBeInTheDocument();
  });

  it('renders the selected user full name as the page title', () => {
    render(<AdminUserDetailPage />);
    expect(screen.getByRole('heading', { name: 'Carlos López' })).toBeInTheDocument();
  });

  it('renders the empty subscriptions message when the user has none', () => {
    render(<AdminUserDetailPage />);
    expect(screen.getByText('Este usuario no tiene suscripciones aún.')).toBeInTheDocument();
  });

  it('opens the resend credentials modal when the resend action is clicked', () => {
    render(<AdminUserDetailPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Reenviar' }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Reenviar credenciales' })).toBeInTheDocument();
  });

  it('renders the trainer assignment section for a customer', () => {
    render(<AdminUserDetailPage />);
    expect(screen.getByText('Entrenador asignado')).toBeInTheDocument();
  });

  it('renders the store error text when loading fails without a selected user', () => {
    setStore({ selected: null, loading: false, error: 'No se pudo cargar el usuario.' });
    render(<AdminUserDetailPage />);
    expect(screen.getByText('No se pudo cargar el usuario.')).toBeInTheDocument();
  });
});
