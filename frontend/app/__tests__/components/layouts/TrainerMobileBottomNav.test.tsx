import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TrainerMobileBottomNav from '@/app/components/layouts/TrainerMobileBottomNav';
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
  default: ({
    children,
    href,
    prefetch: _prefetch,
    ...rest
  }: {
    children: React.ReactNode;
    href: string;
    prefetch?: boolean;
  }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

jest.mock('@/lib/stores/trainerStore', () => ({
  useTrainerStore: jest.fn(),
}));

const mockedUseTrainerStore = useTrainerStore as unknown as jest.Mock;

describe('TrainerMobileBottomNav', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPathname = '/trainer/dashboard';
    useAuthStore.setState({ logout: jest.fn() });
    mockedUseTrainerStore.mockReturnValue({ riskDashboard: null });
  });

  it('renders Inicio link to /trainer/dashboard', () => {
    render(<TrainerMobileBottomNav />);
    expect(screen.getByText('Inicio').closest('a')).toHaveAttribute('href', '/trainer/dashboard');
  });

  it('renders Clientes link to /trainer/clients', () => {
    render(<TrainerMobileBottomNav />);
    expect(screen.getByText('Clientes').closest('a')).toHaveAttribute('href', '/trainer/clients');
  });

  it('renders Alertas link to /trainer/alerts', () => {
    render(<TrainerMobileBottomNav />);
    expect(screen.getByText('Alertas').closest('a')).toHaveAttribute('href', '/trainer/alerts');
  });

  it('renders Métricas link to /trainer/metrics', () => {
    render(<TrainerMobileBottomNav />);
    expect(screen.getByText('Métricas').closest('a')).toHaveAttribute('href', '/trainer/metrics');
  });

  it('renders Más button in the tab bar', () => {
    render(<TrainerMobileBottomNav />);
    expect(screen.getByRole('button', { name: /Más/i })).toBeInTheDocument();
  });

  it('highlights Inicio link when pathname is /trainer/dashboard', () => {
    mockPathname = '/trainer/dashboard';
    render(<TrainerMobileBottomNav />);
    expect(screen.getByText('Inicio').closest('a')).toHaveClass("text-kore-gold");
  });

  it('highlights Clientes link when pathname starts with /trainer/clients', () => {
    mockPathname = '/trainer/clients/42';
    render(<TrainerMobileBottomNav />);
    expect(screen.getByText('Clientes').closest('a')).toHaveClass("text-kore-gold");
  });

  it('highlights Alertas link when pathname is /trainer/alerts', () => {
    mockPathname = '/trainer/alerts';
    render(<TrainerMobileBottomNav />);
    expect(screen.getByText('Alertas').closest('a')).toHaveClass("text-kore-gold");
  });

  it('highlights Métricas link when pathname is /trainer/metrics', () => {
    mockPathname = '/trainer/metrics';
    render(<TrainerMobileBottomNav />);
    expect(screen.getByText('Métricas').closest('a')).toHaveClass("text-kore-gold");
  });

  it('does not show alert badge when alto count is 0', () => {
    mockedUseTrainerStore.mockReturnValue({
      riskDashboard: { risk_summary: { alto: 0, medio: 1, bajo: 0, sin_riesgo: 2 } },
    });
    render(<TrainerMobileBottomNav />);
    expect(screen.queryByText('0')).not.toBeInTheDocument();
  });

  it('shows alert badge with count when alto alerts exist', () => {
    mockedUseTrainerStore.mockReturnValue({
      riskDashboard: { risk_summary: { alto: 4, medio: 1, bajo: 0, sin_riesgo: 0 } },
    });
    render(<TrainerMobileBottomNav />);
    expect(screen.getByText('4')).toBeInTheDocument();
  });

  it('does not show the bottom sheet on initial render', () => {
    render(<TrainerMobileBottomNav />);
    expect(screen.queryByText('Más opciones')).not.toBeInTheDocument();
  });

  it('shows the bottom sheet header when Más is clicked', async () => {
    const user = userEvent.setup();
    render(<TrainerMobileBottomNav />);
    await user.click(screen.getByRole('button', { name: /Más/i }));
    expect(screen.getByText('Más opciones')).toBeInTheDocument();
  });

  it('shows Soporte link when sheet is open', async () => {
    const user = userEvent.setup();
    render(<TrainerMobileBottomNav />);
    await user.click(screen.getByRole('button', { name: /Más/i }));
    expect(screen.getByText('Soporte')).toBeInTheDocument();
  });

  it('shows Cerrar sesión button when sheet is open', async () => {
    const user = userEvent.setup();
    render(<TrainerMobileBottomNav />);
    await user.click(screen.getByRole('button', { name: /Más/i }));
    expect(screen.getByText('Cerrar sesión')).toBeInTheDocument();
  });

  it('applies active class to Más button when sheet is open', async () => {
    const user = userEvent.setup();
    render(<TrainerMobileBottomNav />);
    const masButton = screen.getByRole('button', { name: /Más/i });
    await user.click(masButton);
    expect(masButton).toHaveClass("text-kore-gold");
  });

  it('clears auth state when Cerrar sesión is clicked', async () => {
    const mockLogout = jest.fn();
    useAuthStore.setState({ logout: mockLogout });
    const user = userEvent.setup();
    render(<TrainerMobileBottomNav />);
    await user.click(screen.getByRole('button', { name: /Más/i }));
    await user.click(screen.getByText('Cerrar sesión'));
    expect(mockLogout).toHaveBeenCalledTimes(1);
  });

  it('closes the sheet when backdrop is clicked', async () => {
    const user = userEvent.setup();
    const { container } = render(<TrainerMobileBottomNav />);
    await user.click(screen.getByRole('button', { name: /Más/i }));
    expect(screen.getByText('Más opciones')).toBeInTheDocument();
    const backdrop = container.querySelector('[class*="inset-0"][class*="bg-black"]') as HTMLElement;
    await user.click(backdrop);
    expect(screen.queryByText('Más opciones')).not.toBeInTheDocument();
  });

  it('closes the sheet on mousedown outside the sheet panel', async () => {
    const user = userEvent.setup();
    render(<TrainerMobileBottomNav />);
    await user.click(screen.getByRole('button', { name: /Más/i }));
    expect(screen.getByText('Más opciones')).toBeInTheDocument();
    fireEvent.mouseDown(document.body);
    expect(screen.queryByText('Más opciones')).not.toBeInTheDocument();
  });

  it('closes the sheet when pathname changes', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<TrainerMobileBottomNav />);
    await user.click(screen.getByRole('button', { name: /Más/i }));
    expect(screen.getByText('Más opciones')).toBeInTheDocument();
    mockPathname = '/trainer/clients';
    rerender(<TrainerMobileBottomNav />);
    expect(screen.queryByText('Más opciones')).not.toBeInTheDocument();
  });
});
