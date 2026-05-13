import { render, screen } from '@testing-library/react';
import MobileBottomNav from '@/app/components/layouts/MobileBottomNav';
import { useSubscriptionStore } from '@/lib/stores/subscriptionStore';
import { usePendingAssessmentsStore } from '@/lib/stores/pendingAssessmentsStore';
import type { Subscription } from '@/lib/stores/bookingStore';

let mockPathname = '/dashboard';

jest.mock('next/navigation', () => ({
  usePathname: () => mockPathname,
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

function setupDefaultStores() {
  useSubscriptionStore.setState({ hasActiveSubscription: true, subscriptions: [] });
  usePendingAssessmentsStore.setState({
    nutritionDue: false,
    parqDue: false,
    anthropometryUnseen: false,
    posturometryUnseen: false,
    physicalEvalUnseen: false,
    subscriptionExpiring: false,
    markSeen: jest.fn(),
    loaded: true,
  });
}

describe('MobileBottomNav', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPathname = '/dashboard';
    setupDefaultStores();
  });

  it('renders all 4 tab labels', () => {
    render(<MobileBottomNav />);
    expect(screen.getByText('Inicio')).toBeInTheDocument();
    expect(screen.getByText('Programa')).toBeInTheDocument();
    expect(screen.getByText('Nutrición')).toBeInTheDocument();
    expect(screen.getByText('Perfil')).toBeInTheDocument();
  });

  it('does not include the "Agendar" tab — booking is reached from the dashboard CTA', () => {
    render(<MobileBottomNav />);
    expect(screen.queryByText('Agendar')).not.toBeInTheDocument();
  });

  it('renders no sheet triggers', () => {
    render(<MobileBottomNav />);
    expect(screen.queryByText('Evaluar')).not.toBeInTheDocument();
    expect(screen.queryByText('Más')).not.toBeInTheDocument();
  });

  it('highlights Inicio link when pathname is /dashboard', () => {
    mockPathname = '/dashboard';
    render(<MobileBottomNav />);
    expect(screen.getByText('Inicio').closest('a')).toHaveClass('text-kore-red');
  });

  it('highlights Programa link when pathname is /mi-programa', () => {
    mockPathname = '/mi-programa';
    render(<MobileBottomNav />);
    expect(screen.getByText('Programa').closest('a')).toHaveClass('text-kore-red');
  });

  it('highlights Programa link when pathname starts with /mi-programa', () => {
    mockPathname = '/mi-programa/hoy';
    render(<MobileBottomNav />);
    expect(screen.getByText('Programa').closest('a')).toHaveClass('text-kore-red');
  });

  it('highlights Nutrición link when pathname is /my-nutrition', () => {
    mockPathname = '/my-nutrition';
    render(<MobileBottomNav />);
    expect(screen.getByText('Nutrición').closest('a')).toHaveClass('text-kore-red');
  });

  it('highlights Perfil link when pathname starts with /profile', () => {
    mockPathname = '/profile/edit';
    render(<MobileBottomNav />);
    expect(screen.getByText('Perfil').closest('a')).toHaveClass('text-kore-red');
  });

  it('shows badge on Perfil when anthropometryUnseen is true', () => {
    usePendingAssessmentsStore.setState({ anthropometryUnseen: true });
    render(<MobileBottomNav />);
    const perfilLink = screen.getByText('Perfil').closest('a');
    expect(perfilLink?.querySelector('.animate-pulse')).toBeInTheDocument();
  });

  it('shows badge on Perfil when posturometryUnseen is true', () => {
    usePendingAssessmentsStore.setState({ posturometryUnseen: true });
    render(<MobileBottomNav />);
    const perfilLink = screen.getByText('Perfil').closest('a');
    expect(perfilLink?.querySelector('.animate-pulse')).toBeInTheDocument();
  });

  it('shows badge on Perfil when physicalEvalUnseen is true', () => {
    usePendingAssessmentsStore.setState({ physicalEvalUnseen: true });
    render(<MobileBottomNav />);
    const perfilLink = screen.getByText('Perfil').closest('a');
    expect(perfilLink?.querySelector('.animate-pulse')).toBeInTheDocument();
  });

  it('shows badge on Perfil when nutritionDue is true', () => {
    usePendingAssessmentsStore.setState({ nutritionDue: true });
    render(<MobileBottomNav />);
    const perfilLink = screen.getByText('Perfil').closest('a');
    expect(perfilLink?.querySelector('.animate-pulse')).toBeInTheDocument();
  });

  it('shows badge on Perfil when parqDue is true', () => {
    usePendingAssessmentsStore.setState({ parqDue: true });
    render(<MobileBottomNav />);
    const perfilLink = screen.getByText('Perfil').closest('a');
    expect(perfilLink?.querySelector('.animate-pulse')).toBeInTheDocument();
  });

  it('shows badge on Perfil when subscriptionExpiring is true', () => {
    usePendingAssessmentsStore.setState({ subscriptionExpiring: true });
    render(<MobileBottomNav />);
    const perfilLink = screen.getByText('Perfil').closest('a');
    expect(perfilLink?.querySelector('.animate-pulse')).toBeInTheDocument();
  });

  it('shows no badge on Perfil when no items are pending', () => {
    render(<MobileBottomNav />);
    const perfilLink = screen.getByText('Perfil').closest('a');
    expect(perfilLink?.querySelector('.animate-pulse')).not.toBeInTheDocument();
  });

  it('tabs other than Perfil have no badge even when items pending', () => {
    usePendingAssessmentsStore.setState({ anthropometryUnseen: true });
    render(<MobileBottomNav />);
    const inicioLink = screen.getByText('Inicio').closest('a');
    expect(inicioLink?.querySelector('.animate-pulse')).not.toBeInTheDocument();
  });

  it('renders tabs as disabled (pointer-events-none) when subscription expired', () => {
    useSubscriptionStore.setState({
      hasActiveSubscription: false,
      subscriptions: [{ id: 1 } as Subscription],
    });
    render(<MobileBottomNav />);
    const programaLink = screen.getByText('Programa').closest('a');
    expect(programaLink).toHaveClass('pointer-events-none');
  });

  it('Perfil tab remains enabled when subscription is expired', () => {
    useSubscriptionStore.setState({
      hasActiveSubscription: false,
      subscriptions: [{ id: 1 } as Subscription],
    });
    render(<MobileBottomNav />);
    const perfilLink = screen.getByText('Perfil').closest('a');
    expect(perfilLink).not.toHaveClass('pointer-events-none');
  });

  it('Perfil link points to /profile', () => {
    render(<MobileBottomNav />);
    expect(screen.getByText('Perfil').closest('a')).toHaveAttribute('href', '/profile');
  });

  it('Programa link points to /mi-programa', () => {
    render(<MobileBottomNav />);
    expect(screen.getByText('Programa').closest('a')).toHaveAttribute('href', '/mi-programa');
  });

  it('Nutrición link points to /my-nutrition', () => {
    render(<MobileBottomNav />);
    expect(screen.getByText('Nutrición').closest('a')).toHaveAttribute('href', '/my-nutrition');
  });
});
