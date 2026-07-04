import { render, screen, fireEvent } from '@testing-library/react';
import AdminPlansPage from '@/app/admin-platform/plans/page';
import { useAdminPackageStore } from '@/lib/stores/adminPackageStore';

const mockUsePathname = jest.fn();
jest.mock('next/navigation', () => ({
  usePathname: () => mockUsePathname(),
  useRouter: () => ({ push: jest.fn() }),
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

jest.mock('@/lib/stores/adminPackageStore', () => ({
  useAdminPackageStore: jest.fn(),
}));

const mockedStore = useAdminPackageStore as unknown as jest.Mock;
const mockFetchPackages = jest.fn();
const mockCreatePackage = jest.fn();
const mockUpdatePackage = jest.fn();
const mockToggleActive = jest.fn();

function makePackage(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    title: 'Plan Personalizado Base',
    short_description: 'Entrenamiento uno a uno.',
    description: '',
    category: 'personalizado',
    sessions_count: 8,
    session_duration_minutes: 60,
    price: '400000',
    currency: 'COP',
    validity_days: 30,
    terms_and_conditions: '',
    is_active: true,
    order: 1,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

function setStore(overrides: Record<string, unknown> = {}) {
  mockedStore.mockReturnValue({
    packages: [],
    loading: false,
    actionLoading: false,
    error: '',
    fetchPackages: mockFetchPackages,
    createPackage: mockCreatePackage,
    updatePackage: mockUpdatePackage,
    toggleActive: mockToggleActive,
    ...overrides,
  });
}

beforeEach(() => {
  mockUsePathname.mockReturnValue('/admin-platform/plans');
  setStore();
});

afterEach(() => {
  jest.clearAllMocks();
});

describe('AdminPlansPage', () => {
  it('renders the plans management heading', () => {
    render(<AdminPlansPage />);
    expect(screen.getByRole('heading', { name: 'Gestión de planes' })).toBeInTheDocument();
  });

  it('fetches packages on mount', () => {
    render(<AdminPlansPage />);
    expect(mockFetchPackages).toHaveBeenCalledTimes(1);
  });

  it('renders a card for a package in the active category', () => {
    setStore({ packages: [makePackage({ title: 'Plan Personalizado Base' })] });
    render(<AdminPlansPage />);
    expect(screen.getByText('Plan Personalizado Base')).toBeInTheDocument();
  });

  it('renders the empty state when the active category has no packages', () => {
    setStore({ packages: [] });
    render(<AdminPlansPage />);
    expect(screen.getByText('Sin planes en esta categoría')).toBeInTheDocument();
  });

  it('renders the loading state while packages are loading', () => {
    setStore({ loading: true });
    render(<AdminPlansPage />);
    expect(screen.getByText('Cargando planes…')).toBeInTheDocument();
  });

  it('renders the store error banner when an error is present', () => {
    setStore({ error: 'No se pudo cargar.' });
    render(<AdminPlansPage />);
    expect(screen.getByText('No se pudo cargar.')).toBeInTheDocument();
  });

  it('opens the create modal when the create plan button is clicked', () => {
    render(<AdminPlansPage />);
    fireEvent.click(screen.getByRole('button', { name: /Crear plan/ }));
    expect(screen.getByText('Crear plan de entrenamiento')).toBeInTheDocument();
  });
});
