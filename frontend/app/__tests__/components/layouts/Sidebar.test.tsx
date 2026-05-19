import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Sidebar from '@/app/components/layouts/Sidebar';
import { useAuthStore } from '@/lib/stores/authStore';
import { useProfileStore } from '@/lib/stores/profileStore';
import { usePendingAssessmentsStore } from '@/lib/stores/pendingAssessmentsStore';

const mockPush = jest.fn();
let mockPathname = '/dashboard';

jest.mock('next/navigation', () => ({
  usePathname: () => mockPathname,
  useRouter: () => ({ push: mockPush }),
}));

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href, prefetch: _prefetch, ...rest }: { children: React.ReactNode; href: string; prefetch?: boolean }) => (
    <a href={href} {...rest}>{children}</a>
  ),
}));

jest.mock('js-cookie', () => ({
  get: jest.fn(),
  set: jest.fn(),
  remove: jest.fn(),
}));

const mockUser = {
  id: '22',
  email: 'customer10@kore.com',
  first_name: 'Customer10',
  last_name: 'Kore',
  phone: '',
  role: 'customer',
  name: 'Customer10 Kore',
  profile_completed: false,
  avatar_url: null as string | null,
};

describe('Sidebar', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPathname = '/dashboard';
    useAuthStore.setState({ user: mockUser, isAuthenticated: true, accessToken: 'token' });
  });

  it('renders the brand name linking to dashboard', () => {
    render(<Sidebar />);
    expect(screen.getByText('KÓRE')).toBeInTheDocument();
  });

  it('displays user name and email', () => {
    render(<Sidebar />);
    expect(screen.getByText('Customer10 Kore')).toBeInTheDocument();
    expect(screen.getByText('customer10@kore.com')).toBeInTheDocument();
  });

  it('displays user initial avatar', () => {
    render(<Sidebar />);
    expect(screen.getByText('CK')).toBeInTheDocument();
  });

  it('renders navigation items', () => {
    render(<Sidebar />);
    expect(screen.getByText('Inicio')).toBeInTheDocument();
    expect(screen.getByText('Mi Suscripción')).toBeInTheDocument();
  });

  it('does not include "Agendar Sesión" — booking is reached from the dashboard CTA', () => {
    render(<Sidebar />);
    expect(screen.queryByText('Agendar Sesión')).not.toBeInTheDocument();
  });

  it('highlights active nav item based on pathname', () => {
    mockPathname = '/dashboard';
    render(<Sidebar />);
    const dashboardLink = screen.getByText('Inicio').closest('a');
    expect(dashboardLink).toHaveClass('from-kore-petal/15');
  });

  it('highlights Mi Suscripción for nested routes', () => {
    mockPathname = '/subscription';
    render(<Sidebar />);
    const subscriptionLink = screen.getByText('Mi Suscripción').closest('a');
    expect(subscriptionLink).toHaveClass('from-kore-petal/15');
  });

  it('renders Soporte link and Cerrar sesión button', () => {
    render(<Sidebar />);
    expect(screen.getByText('Soporte')).toBeInTheDocument();
    expect(screen.getByText('Cerrar sesión')).toBeInTheDocument();
  });

  it('calls logout on Cerrar sesión click', async () => {
    render(<Sidebar />);
    const user = userEvent.setup();

    await user.click(screen.getByText('Cerrar sesión'));

    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(false);
    expect(state.user).toBeNull();
  });

  it('does not render user info when user is null', () => {
    useAuthStore.setState({ user: null, isAuthenticated: false, accessToken: null });
    render(<Sidebar />);
    expect(screen.queryByText('Customer10 Kore')).not.toBeInTheDocument();
  });

  it('renders avatar image when user has avatar_url', () => {
    useAuthStore.setState({
      user: { ...mockUser, avatar_url: 'https://cdn.kore.com/avatar.jpg' },
      isAuthenticated: true,
      accessToken: 'token',
    });
    render(<Sidebar />);
    const img = screen.getByAltText('Avatar');
    expect(img).toBeInTheDocument();
  });

  it('displays goal label instead of email when profile has primary_goal', () => {
    useProfileStore.setState({
      profile: {
        id: 22,
        email: 'customer10@kore.com',
        first_name: 'Customer10',
        last_name: 'Kore',
        phone: '',
        role: 'customer',
        customer_profile: {
          avatar_url: null,
          sex: 'M',
          date_of_birth: null,
          eps: '',
          id_type: 'CC',
          id_number: '',
          id_expedition_date: null,
          address: '',
          city: '',
          primary_goal: 'fat_loss',
          kore_start_date: null,
          profile_completed: true,
        },
        today_mood: null,
      } as import('@/lib/stores/profileStore').ProfileData,
    });
    render(<Sidebar />);
    expect(screen.getByText('Perder grasa')).toBeInTheDocument();
    expect(screen.queryByText('customer10@kore.com')).not.toBeInTheDocument();
  });

  it('calls markSeen for anthropometry when Antropometría is clicked', async () => {
    const markSeenSpy = jest.fn();
    usePendingAssessmentsStore.setState({
      anthropometryUnseen: true,
      loaded: true,
      markSeen: markSeenSpy,
    });
    const user = userEvent.setup();
    render(<Sidebar />);
    await user.click(screen.getByText('Antropometría'));
    expect(markSeenSpy).toHaveBeenCalledWith('anthropometry');
  });

  it('calls markSeen for posturometry when Evaluación Postural is clicked', async () => {
    const markSeenSpy = jest.fn();
    usePendingAssessmentsStore.setState({
      posturometryUnseen: true,
      loaded: true,
      markSeen: markSeenSpy,
    });
    const user = userEvent.setup();
    render(<Sidebar />);
    await user.click(screen.getByText('Evaluación Postural'));
    expect(markSeenSpy).toHaveBeenCalledWith('posturometry');
  });

  it('calls markSeen for physical_eval when Evaluación Física is clicked', async () => {
    const markSeenSpy = jest.fn();
    usePendingAssessmentsStore.setState({
      physicalEvalUnseen: true,
      loaded: true,
      markSeen: markSeenSpy,
    });
    const user = userEvent.setup();
    render(<Sidebar />);
    await user.click(screen.getByText('Evaluación Física'));
    expect(markSeenSpy).toHaveBeenCalledWith('physical_eval');
  });
});
