import { render, screen, fireEvent } from '@testing-library/react';
import TrainerSidebar from '@/app/components/layouts/TrainerSidebar';
import { useAuthStore } from '@/lib/stores/authStore';
import { useTrainerStore } from '@/lib/stores/trainerStore';

const mockPush = jest.fn();
let mockPathname = '/trainer/dashboard';

jest.mock('next/navigation', () => ({
  usePathname: () => mockPathname,
  useRouter: () => ({ push: mockPush }),
}));

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href, onClick, ...rest }: { children: React.ReactNode; href: string; onClick?: () => void; prefetch?: boolean }) => (
    <a href={href} onClick={onClick} {...rest}>{children}</a>
  ),
}));

jest.mock('@/lib/stores/authStore', () => ({
  useAuthStore: jest.fn(),
}));

jest.mock('@/lib/stores/trainerStore', () => ({
  useTrainerStore: jest.fn(),
}));

const mockedUseAuthStore = useAuthStore as unknown as jest.Mock;
const mockedUseTrainerStore = useTrainerStore as unknown as jest.Mock;

function setupStore(overrides: Record<string, unknown> = {}, trainerOverrides: Record<string, unknown> = {}) {
  const mockLogout = jest.fn();
  mockedUseAuthStore.mockReturnValue({
    user: { name: 'Trainer Carlos', email: 'trainer@kore.com' },
    logout: mockLogout,
    ...overrides,
  });
  mockedUseTrainerStore.mockReturnValue({
    riskDashboard: null,
    ...trainerOverrides,
  });
  return { mockLogout };
}

describe('TrainerSidebar', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPathname = '/trainer/dashboard';
  });

  it('renders logo linking to trainer dashboard', () => {
    setupStore();
    render(<TrainerSidebar />);

    const logoLink = screen.getByText('KÓRE').closest('a');
    expect(logoLink).toHaveAttribute('href', '/trainer/dashboard');
  });

  it('renders user name and role when user is present', () => {
    setupStore();
    render(<TrainerSidebar />);

    expect(screen.getByText('Trainer Carlos')).toBeInTheDocument();
    expect(screen.getAllByText('Entrenador').length).toBeGreaterThanOrEqual(1);
  });

  it('renders user initials avatar', () => {
    setupStore();
    render(<TrainerSidebar />);

    expect(screen.getByText('TC')).toBeInTheDocument();
  });

  it('does not render user name when user is null', () => {
    setupStore({ user: null });
    render(<TrainerSidebar />);

    expect(screen.queryByText('Trainer Carlos')).not.toBeInTheDocument();
  });

  it('renders core nav items', () => {
    setupStore();
    render(<TrainerSidebar />);

    expect(screen.getByText('Hoy')).toBeInTheDocument();
    expect(screen.getByText('Mis Clientes')).toBeInTheDocument();
    expect(screen.getByText('Alertas')).toBeInTheDocument();
    expect(screen.getByText('Métricas')).toBeInTheDocument();
    expect(screen.getByText('Evidencia')).toBeInTheDocument();
  });

  it('Hoy link points to /trainer/dashboard', () => {
    setupStore();
    render(<TrainerSidebar />);

    const link = screen.getByText('Hoy').closest('a');
    expect(link).toHaveAttribute('href', '/trainer/dashboard');
  });

  it('Mis Clientes link points to /trainer/clients', () => {
    setupStore();
    render(<TrainerSidebar />);

    const link = screen.getByText('Mis Clientes').closest('a');
    expect(link).toHaveAttribute('href', '/trainer/clients');
  });

  it('Alertas link points to /trainer/alerts', () => {
    setupStore();
    render(<TrainerSidebar />);

    const link = screen.getByText('Alertas').closest('a');
    expect(link).toHaveAttribute('href', '/trainer/alerts');
  });

  it('Métricas link points to /trainer/metrics', () => {
    setupStore();
    render(<TrainerSidebar />);

    const link = screen.getByText('Métricas').closest('a');
    expect(link).toHaveAttribute('href', '/trainer/metrics');
  });

  it('Evidencia link points to /trainer/evidence', () => {
    setupStore();
    render(<TrainerSidebar />);

    const link = screen.getByText('Evidencia').closest('a');
    expect(link).toHaveAttribute('href', '/trainer/evidence');
  });

  it('does not show alert badge when alto and medio counts are 0', () => {
    setupStore({}, { riskDashboard: { risk_summary: { alto: 0, medio: 0, bajo: 1, sin_riesgo: 3 } } });
    render(<TrainerSidebar />);

    expect(screen.queryByText('0')).not.toBeInTheDocument();
  });

  it('shows alert badge with combined alto+medio count', () => {
    setupStore({}, { riskDashboard: { risk_summary: { alto: 3, medio: 0, bajo: 0, sin_riesgo: 2 } } });
    render(<TrainerSidebar />);

    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('shows 99+ badge when alto count exceeds 99', () => {
    setupStore({}, { riskDashboard: { risk_summary: { alto: 150, medio: 0, bajo: 0, sin_riesgo: 0 } } });
    render(<TrainerSidebar />);

    expect(screen.getByText('99+')).toBeInTheDocument();
  });

  it('renders logout button', () => {
    setupStore();
    render(<TrainerSidebar />);

    expect(screen.getByRole('button', { name: 'Cerrar sesión' })).toBeInTheDocument();
  });

  it('calls logout and navigates to / on logout click', () => {
    const { mockLogout } = setupStore();
    render(<TrainerSidebar />);

    fireEvent.click(screen.getByRole('button', { name: 'Cerrar sesión' }));

    expect(mockLogout).toHaveBeenCalled();
    expect(mockPush).toHaveBeenCalledWith('/');
  });

  it('renders Mis Clientes link with correct href', () => {
    mockPathname = '/trainer/clients';
    setupStore();
    render(<TrainerSidebar />);

    const clientsLink = screen.getByText('Mis Clientes').closest('a');
    expect(clientsLink).toHaveAttribute('href', '/trainer/clients');
  });

  it('renders Hoy link with /trainer/dashboard href', () => {
    mockPathname = '/trainer/dashboard';
    setupStore();
    render(<TrainerSidebar />);

    const homeLink = screen.getByText('Hoy').closest('a');
    expect(homeLink).toHaveAttribute('href', '/trainer/dashboard');
  });

  it('renders Alertas link when pathname starts with /trainer/alerts', () => {
    mockPathname = '/trainer/alerts';
    setupStore();
    render(<TrainerSidebar />);

    const alertsLink = screen.getByText('Alertas').closest('a');
    expect(alertsLink).toHaveAttribute('href', '/trainer/alerts');
  });
});
