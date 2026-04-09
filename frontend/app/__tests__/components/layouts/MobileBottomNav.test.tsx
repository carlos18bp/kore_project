import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MobileBottomNav from '@/app/components/layouts/MobileBottomNav';
import { useAuthStore } from '@/lib/stores/authStore';
import { useSubscriptionStore } from '@/lib/stores/subscriptionStore';
import { usePendingAssessmentsStore } from '@/lib/stores/pendingAssessmentsStore';
import type { Subscription } from '@/lib/stores/bookingStore';

const mockPush = jest.fn();
let mockPathname = '/dashboard';

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

const mockMarkSeen = jest.fn();
const mockLogout = jest.fn();

function setupDefaultStores() {
  useAuthStore.setState({ logout: mockLogout });
  useSubscriptionStore.setState({ hasActiveSubscription: true, subscriptions: [] });
  usePendingAssessmentsStore.setState({
    nutritionDue: false,
    parqDue: false,
    anthropometryUnseen: false,
    posturometryUnseen: false,
    physicalEvalUnseen: false,
    subscriptionExpiring: false,
    markSeen: mockMarkSeen,
    loaded: true,
  });
}

describe('MobileBottomNav', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPathname = '/dashboard';
    setupDefaultStores();
  });

  it('renders Inicio tab item', () => {
    render(<MobileBottomNav />);
    expect(screen.getByText('Inicio')).toBeInTheDocument();
  });

  it('renders Agendar tab item', () => {
    render(<MobileBottomNav />);
    expect(screen.getByText('Agendar')).toBeInTheDocument();
  });

  it('renders Evaluar tab button', () => {
    render(<MobileBottomNav />);
    expect(screen.getByText('Evaluar')).toBeInTheDocument();
  });

  it('renders Perfil tab item', () => {
    render(<MobileBottomNav />);
    expect(screen.getByText('Perfil')).toBeInTheDocument();
  });

  it('renders Más tab button', () => {
    render(<MobileBottomNav />);
    expect(screen.getByText('Más')).toBeInTheDocument();
  });

  it('highlights Inicio link when pathname is /dashboard', () => {
    mockPathname = '/dashboard';
    render(<MobileBottomNav />);
    expect(screen.getByText('Inicio').closest('a')).toHaveClass('text-kore-red');
  });

  it('highlights Agendar link when pathname starts with /book-session', () => {
    mockPathname = '/book-session/confirm';
    render(<MobileBottomNav />);
    expect(screen.getByText('Agendar').closest('a')).toHaveClass('text-kore-red');
  });

  it('highlights Perfil link when pathname starts with /profile', () => {
    mockPathname = '/profile/edit';
    render(<MobileBottomNav />);
    expect(screen.getByText('Perfil').closest('a')).toHaveClass('text-kore-red');
  });

  it('shows eval badge when anthropometryUnseen is true', () => {
    usePendingAssessmentsStore.setState({ anthropometryUnseen: true });
    render(<MobileBottomNav />);
    const evalButton = screen.getByText('Evaluar').closest('button');
    expect(evalButton?.querySelector('.animate-pulse')).toBeInTheDocument();
  });

  it('shows eval badge when posturometryUnseen is true', () => {
    usePendingAssessmentsStore.setState({ posturometryUnseen: true });
    render(<MobileBottomNav />);
    const evalButton = screen.getByText('Evaluar').closest('button');
    expect(evalButton?.querySelector('.animate-pulse')).toBeInTheDocument();
  });

  it('shows eval badge when physicalEvalUnseen is true', () => {
    usePendingAssessmentsStore.setState({ physicalEvalUnseen: true });
    render(<MobileBottomNav />);
    const evalButton = screen.getByText('Evaluar').closest('button');
    expect(evalButton?.querySelector('.animate-pulse')).toBeInTheDocument();
  });

  it('shows Más badge when nutritionDue is true', () => {
    usePendingAssessmentsStore.setState({ nutritionDue: true });
    render(<MobileBottomNav />);
    const masButton = screen.getByText('Más').closest('button');
    expect(masButton?.querySelector('.animate-pulse')).toBeInTheDocument();
  });

  it('shows Más badge when parqDue is true', () => {
    usePendingAssessmentsStore.setState({ parqDue: true });
    render(<MobileBottomNav />);
    const masButton = screen.getByText('Más').closest('button');
    expect(masButton?.querySelector('.animate-pulse')).toBeInTheDocument();
  });

  it('shows Más badge when subscriptionExpiring is true', () => {
    usePendingAssessmentsStore.setState({ subscriptionExpiring: true });
    render(<MobileBottomNav />);
    const masButton = screen.getByText('Más').closest('button');
    expect(masButton?.querySelector('.animate-pulse')).toBeInTheDocument();
  });

  it('opens evaluaciones sheet showing Mi Diagnóstico when Evaluar is clicked', async () => {
    const user = userEvent.setup();
    render(<MobileBottomNav />);
    await user.click(screen.getByText('Evaluar'));
    expect(screen.getByText('Mi Diagnóstico')).toBeInTheDocument();
  });

  it('opens evaluaciones sheet showing Evaluación Postural when Evaluar is clicked', async () => {
    const user = userEvent.setup();
    render(<MobileBottomNav />);
    await user.click(screen.getByText('Evaluar'));
    expect(screen.getByText('Evaluación Postural')).toBeInTheDocument();
  });

  it('opens evaluaciones sheet showing Evaluación Física when Evaluar is clicked', async () => {
    const user = userEvent.setup();
    render(<MobileBottomNav />);
    await user.click(screen.getByText('Evaluar'));
    expect(screen.getByText('Evaluación Física')).toBeInTheDocument();
  });

  it('opens Más sheet showing Mi Nutrición when Más is clicked', async () => {
    const user = userEvent.setup();
    render(<MobileBottomNav />);
    await user.click(screen.getByText('Más'));
    expect(screen.getByText('Mi Nutrición')).toBeInTheDocument();
  });

  it('opens Más sheet showing Soporte link when Más is clicked', async () => {
    const user = userEvent.setup();
    render(<MobileBottomNav />);
    await user.click(screen.getByText('Más'));
    expect(screen.getByText('Soporte')).toBeInTheDocument();
  });

  it('opens Más sheet showing Cerrar sesión when Más is clicked', async () => {
    const user = userEvent.setup();
    render(<MobileBottomNav />);
    await user.click(screen.getByText('Más'));
    expect(screen.getByText('Cerrar sesión')).toBeInTheDocument();
  });

  it('calls markSeen with anthropometry key when Mi Diagnóstico is navigated to', async () => {
    const user = userEvent.setup();
    render(<MobileBottomNav />);
    await user.click(screen.getByText('Evaluar'));
    await user.click(screen.getByText('Mi Diagnóstico'));
    expect(mockMarkSeen).toHaveBeenCalledWith('anthropometry');
  });

  it('navigates to /my-diagnosis when Mi Diagnóstico is clicked', async () => {
    const user = userEvent.setup();
    render(<MobileBottomNav />);
    await user.click(screen.getByText('Evaluar'));
    await user.click(screen.getByText('Mi Diagnóstico'));
    expect(mockPush).toHaveBeenCalledWith('/my-diagnosis');
  });

  it('calls markSeen with posturometry key when Evaluación Postural is navigated to', async () => {
    const user = userEvent.setup();
    render(<MobileBottomNav />);
    await user.click(screen.getByText('Evaluar'));
    await user.click(screen.getByText('Evaluación Postural'));
    expect(mockMarkSeen).toHaveBeenCalledWith('posturometry');
  });

  it('calls markSeen with physical_eval key when Evaluación Física is navigated to', async () => {
    const user = userEvent.setup();
    render(<MobileBottomNav />);
    await user.click(screen.getByText('Evaluar'));
    await user.click(screen.getByText('Evaluación Física'));
    expect(mockMarkSeen).toHaveBeenCalledWith('physical_eval');
  });

  it('navigates to /my-nutrition without calling markSeen', async () => {
    const user = userEvent.setup();
    render(<MobileBottomNav />);
    await user.click(screen.getByText('Más'));
    await user.click(screen.getByText('Mi Nutrición'));
    expect(mockMarkSeen).not.toHaveBeenCalled();
    expect(mockPush).toHaveBeenCalledWith('/my-nutrition');
  });

  it('calls logout when Cerrar sesión is clicked', async () => {
    const user = userEvent.setup();
    render(<MobileBottomNav />);
    await user.click(screen.getByText('Más'));
    await user.click(screen.getByText('Cerrar sesión'));
    expect(mockLogout).toHaveBeenCalledTimes(1);
  });

  it('navigates to / when Cerrar sesión is clicked', async () => {
    const user = userEvent.setup();
    render(<MobileBottomNav />);
    await user.click(screen.getByText('Más'));
    await user.click(screen.getByText('Cerrar sesión'));
    expect(mockPush).toHaveBeenCalledWith('/');
  });

  it('highlights Evaluar button as active when evaluaciones sheet is open', async () => {
    const user = userEvent.setup();
    render(<MobileBottomNav />);
    await user.click(screen.getByText('Evaluar'));
    const evalButton = screen.getByText('Evaluar').closest('button');
    expect(evalButton).toHaveClass('text-kore-red');
  });

  it('highlights Más button as active when mas sheet is open', async () => {
    const user = userEvent.setup();
    render(<MobileBottomNav />);
    await user.click(screen.getByText('Más'));
    const masButton = screen.getByText('Más').closest('button');
    expect(masButton).toHaveClass('text-kore-red');
  });

  it('closes evaluaciones sheet on mousedown outside the sheet panel', async () => {
    const user = userEvent.setup();
    render(<MobileBottomNav />);
    await user.click(screen.getByText('Evaluar'));
    expect(screen.getByText('Mi Diagnóstico')).toBeInTheDocument();
    fireEvent.mouseDown(document.body);
    expect(screen.queryByText('Mi Diagnóstico')).not.toBeInTheDocument();
  });

  it('closes the sheet on mousedown outside the sheet panel', async () => {
    const user = userEvent.setup();
    render(<MobileBottomNav />);
    await user.click(screen.getByText('Más'));
    expect(screen.getByText('Más opciones')).toBeInTheDocument();
    fireEvent.mouseDown(document.body);
    expect(screen.queryByText('Más opciones')).not.toBeInTheDocument();
  });

  it('closes the sheet when pathname changes', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<MobileBottomNav />);
    await user.click(screen.getByText('Más'));
    expect(screen.getByText('Más opciones')).toBeInTheDocument();
    mockPathname = '/my-nutrition';
    rerender(<MobileBottomNav />);
    expect(screen.queryByText('Más opciones')).not.toBeInTheDocument();
  });

  it('renders evaluation item as disabled span when subscription is expired', async () => {
    useSubscriptionStore.setState({
      hasActiveSubscription: false,
      subscriptions: [{ id: 1 } as Subscription],
    });
    const user = userEvent.setup();
    render(<MobileBottomNav />);
    await user.click(screen.getByText('Evaluar'));
    const disabledItem = screen.getByText('Mi Diagnóstico').closest('span');
    expect(disabledItem).toBeInTheDocument();
  });

  it('renders Mi Suscripción as button even when subscription is expired', async () => {
    useSubscriptionStore.setState({
      hasActiveSubscription: false,
      subscriptions: [{ id: 1 } as Subscription],
    });
    const user = userEvent.setup();
    render(<MobileBottomNav />);
    await user.click(screen.getByText('Más'));
    const allowedItem = screen.getByText('Mi Suscripción').closest('button');
    expect(allowedItem).toBeInTheDocument();
  });
});
