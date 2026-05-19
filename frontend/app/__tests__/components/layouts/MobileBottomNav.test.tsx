import { render, screen } from '@testing-library/react';
import MobileBottomNav from '@/app/components/layouts/MobileBottomNav';
import { useSubscriptionStore } from '@/lib/stores/subscriptionStore';
import { usePendingAssessmentsStore } from '@/lib/stores/pendingAssessmentsStore';
import type { Subscription } from '@/lib/stores/bookingStore';

let mockPathname = '/dashboard';
const mockPush = jest.fn();

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

  it('renders the Evaluaciones sheet trigger between Nutrición and Perfil', () => {
    render(<MobileBottomNav />);
    expect(screen.queryByText('Más')).not.toBeInTheDocument();
    expect(screen.getByText('Evaluaciones')).toBeInTheDocument();
  });

  it('highlights Inicio link when pathname is /dashboard', () => {
    mockPathname = '/dashboard';
    render(<MobileBottomNav />);
    expect(screen.getByText('Inicio').closest('a')).toHaveClass("text-kore-gold");
  });

  it('highlights Programa link when pathname is /mi-programa', () => {
    mockPathname = '/mi-programa';
    render(<MobileBottomNav />);
    expect(screen.getByText('Programa').closest('a')).toHaveClass("text-kore-gold");
  });

  it('highlights Programa link when pathname starts with /mi-programa', () => {
    mockPathname = '/mi-programa/hoy';
    render(<MobileBottomNav />);
    expect(screen.getByText('Programa').closest('a')).toHaveClass("text-kore-gold");
  });

  it('highlights Nutrición link when pathname is /my-nutrition', () => {
    mockPathname = '/my-nutrition';
    render(<MobileBottomNav />);
    expect(screen.getByText('Nutrición').closest('a')).toHaveClass("text-kore-gold");
  });

  it('highlights Perfil link when pathname starts with /profile', () => {
    mockPathname = '/profile/edit';
    render(<MobileBottomNav />);
    expect(screen.getByText('Perfil').closest('a')).toHaveClass("text-kore-gold");
  });

  it('shows badge on Evaluaciones when anthropometryUnseen is true', () => {
    usePendingAssessmentsStore.setState({ anthropometryUnseen: true });
    render(<MobileBottomNav />);
    const trigger = screen.getByText('Evaluaciones').closest('button');
    expect(trigger?.querySelector('.animate-pulse')).toBeInTheDocument();
  });

  it('shows badge on Evaluaciones when posturometryUnseen is true', () => {
    usePendingAssessmentsStore.setState({ posturometryUnseen: true });
    render(<MobileBottomNav />);
    const trigger = screen.getByText('Evaluaciones').closest('button');
    expect(trigger?.querySelector('.animate-pulse')).toBeInTheDocument();
  });

  it('shows badge on Evaluaciones when physicalEvalUnseen is true', () => {
    usePendingAssessmentsStore.setState({ physicalEvalUnseen: true });
    render(<MobileBottomNav />);
    const trigger = screen.getByText('Evaluaciones').closest('button');
    expect(trigger?.querySelector('.animate-pulse')).toBeInTheDocument();
  });

  it('shows badge on Evaluaciones when parqDue is true', () => {
    usePendingAssessmentsStore.setState({ parqDue: true });
    render(<MobileBottomNav />);
    const trigger = screen.getByText('Evaluaciones').closest('button');
    expect(trigger?.querySelector('.animate-pulse')).toBeInTheDocument();
  });

  it('shows badge on Nutrición tab when nutritionDue is true', () => {
    usePendingAssessmentsStore.setState({ nutritionDue: true });
    render(<MobileBottomNav />);
    const tab = screen.getByText('Nutrición').closest('a');
    expect(tab?.querySelector('.animate-pulse')).toBeInTheDocument();
  });

  it('shows badge on Perfil when subscriptionExpiring is true', () => {
    usePendingAssessmentsStore.setState({ subscriptionExpiring: true });
    render(<MobileBottomNav />);
    const perfilLink = screen.getByText('Perfil').closest('a');
    expect(perfilLink?.querySelector('.animate-pulse')).toBeInTheDocument();
  });

  it('shows no badges when nothing is pending', () => {
    render(<MobileBottomNav />);
    expect(screen.getByText('Perfil').closest('a')?.querySelector('.animate-pulse')).not.toBeInTheDocument();
    expect(screen.getByText('Evaluaciones').closest('button')?.querySelector('.animate-pulse')).not.toBeInTheDocument();
    expect(screen.getByText('Nutrición').closest('a')?.querySelector('.animate-pulse')).not.toBeInTheDocument();
  });

  it('keeps non-eval tabs unbadged when only eval items are pending', () => {
    usePendingAssessmentsStore.setState({ anthropometryUnseen: true });
    render(<MobileBottomNav />);
    expect(screen.getByText('Inicio').closest('a')?.querySelector('.animate-pulse')).not.toBeInTheDocument();
    expect(screen.getByText('Programa').closest('a')?.querySelector('.animate-pulse')).not.toBeInTheDocument();
    expect(screen.getByText('Perfil').closest('a')?.querySelector('.animate-pulse')).not.toBeInTheDocument();
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
