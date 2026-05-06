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
    expect(screen.getByText('Entrenador')).toBeInTheDocument();
  });

  it('renders user initial avatar', () => {
    setupStore();
    render(<TrainerSidebar />);

    expect(screen.getByText('T')).toBeInTheDocument();
  });

  it('does not render user info when user is null', () => {
    setupStore({ user: null });
    render(<TrainerSidebar />);

    expect(screen.queryByText('Entrenador')).not.toBeInTheDocument();
  });

  it('renders all 5 nav items', () => {
    setupStore();
    render(<TrainerSidebar />);

    expect(screen.getByText('Inicio')).toBeInTheDocument();
    expect(screen.getByText('Mis Clientes')).toBeInTheDocument();
    expect(screen.getByText('Alertas')).toBeInTheDocument();
    expect(screen.getByText('Comparativas')).toBeInTheDocument();
    expect(screen.getByText('Evidencia')).toBeInTheDocument();
  });

  it('Inicio link points to /trainer/dashboard', () => {
    setupStore();
    render(<TrainerSidebar />);

    const link = screen.getByText('Inicio').closest('a');
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

  it('Comparativas link points to /trainer/metrics', () => {
    setupStore();
    render(<TrainerSidebar />);

    const link = screen.getByText('Comparativas').closest('a');
    expect(link).toHaveAttribute('href', '/trainer/metrics');
  });

  it('Evidencia link points to /trainer/evidence', () => {
    setupStore();
    render(<TrainerSidebar />);

    const link = screen.getByText('Evidencia').closest('a');
    expect(link).toHaveAttribute('href', '/trainer/evidence');
  });

  it('does not show alert badge when alto count is 0', () => {
    setupStore({}, { riskDashboard: { risk_summary: { alto: 0, medio: 2, bajo: 1, sin_riesgo: 3 } } });
    render(<TrainerSidebar />);

    expect(screen.queryByText('0')).not.toBeInTheDocument();
  });

  it('shows alert badge with count when alto alerts exist', () => {
    setupStore({}, { riskDashboard: { risk_summary: { alto: 3, medio: 1, bajo: 0, sin_riesgo: 2 } } });
    render(<TrainerSidebar />);

    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('shows 99+ badge when alto count exceeds 99', () => {
    setupStore({}, { riskDashboard: { risk_summary: { alto: 150, medio: 0, bajo: 0, sin_riesgo: 0 } } });
    render(<TrainerSidebar />);

    expect(screen.getByText('99+')).toBeInTheDocument();
  });

  it('renders Soporte link pointing to WhatsApp', () => {
    setupStore();
    render(<TrainerSidebar />);

    const supportLink = screen.getByText('Soporte').closest('a');
    expect(supportLink).toHaveAttribute('href', expect.stringContaining('whatsapp'));
    expect(supportLink).toHaveAttribute('target', '_blank');
    expect(supportLink).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('renders Cerrar sesión button', () => {
    setupStore();
    render(<TrainerSidebar />);

    expect(screen.getByText('Cerrar sesión')).toBeInTheDocument();
  });

  it('calls logout and navigates to / on Cerrar sesión click', () => {
    const { mockLogout } = setupStore();
    render(<TrainerSidebar />);

    fireEvent.click(screen.getByText('Cerrar sesión'));

    expect(mockLogout).toHaveBeenCalled();
    expect(mockPush).toHaveBeenCalledWith('/');
  });

  it('highlights active nav item for current pathname', () => {
    mockPathname = '/trainer/clients';
    setupStore();
    render(<TrainerSidebar />);

    const clientsLink = screen.getByText('Mis Clientes').closest('a');
    expect(clientsLink?.className).toContain('bg-kore-red/10');

    const homeLink = screen.getByText('Inicio').closest('a');
    expect(homeLink?.className).not.toContain('bg-kore-red/10');
  });

  it('highlights Inicio only on exact /trainer/dashboard match', () => {
    mockPathname = '/trainer/dashboard';
    setupStore();
    render(<TrainerSidebar />);

    const homeLink = screen.getByText('Inicio').closest('a');
    expect(homeLink?.className).toContain('bg-kore-red/10');
  });

  it('highlights Alertas when pathname starts with /trainer/alerts', () => {
    mockPathname = '/trainer/alerts';
    setupStore();
    render(<TrainerSidebar />);

    const alertsLink = screen.getByText('Alertas').closest('a');
    expect(alertsLink?.className).toContain('bg-kore-red/10');
  });
});
