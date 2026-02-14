import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Sidebar from '@/app/components/layouts/Sidebar';
import { useAuthStore } from '@/lib/stores/authStore';

const mockPush = jest.fn();
let mockPathname = '/dashboard';

jest.mock('next/navigation', () => ({
  usePathname: () => mockPathname,
  useRouter: () => ({ push: mockPush }),
}));

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href, ...rest }: { children: React.ReactNode; href: string }) => (
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
    expect(screen.getByText('C')).toBeInTheDocument();
  });

  it('renders navigation items', () => {
    render(<Sidebar />);
    expect(screen.getByText('Inicio')).toBeInTheDocument();
    expect(screen.getByText('Agendar Sesión')).toBeInTheDocument();
    expect(screen.getByText('Mis Sesiones')).toBeInTheDocument();
  });

  it('highlights active nav item based on pathname', () => {
    mockPathname = '/book-session';
    render(<Sidebar />);
    const bookSessionLink = screen.getByText('Agendar Sesión').closest('a');
    expect(bookSessionLink).toHaveClass('bg-kore-red/10');
  });

  it('highlights Mis Sesiones for nested routes', () => {
    mockPathname = '/my-sessions/program/1';
    render(<Sidebar />);
    const mySessionsLink = screen.getByText('Mis Sesiones').closest('a');
    expect(mySessionsLink).toHaveClass('bg-kore-red/10');
  });

  it('renders Soporte link and Cerrar sesión button', () => {
    render(<Sidebar />);
    expect(screen.getByText('Soporte')).toBeInTheDocument();
    expect(screen.getByText('Cerrar sesión')).toBeInTheDocument();
  });

  it('calls logout and redirects to home on Cerrar sesión click', async () => {
    render(<Sidebar />);
    const user = userEvent.setup();

    await user.click(screen.getByText('Cerrar sesión'));

    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(false);
    expect(state.user).toBeNull();
    expect(mockPush).toHaveBeenCalledWith('/');
  });

  it('does not render user info when user is null', () => {
    useAuthStore.setState({ user: null, isAuthenticated: false, accessToken: null });
    render(<Sidebar />);
    expect(screen.queryByText('Customer10 Kore')).not.toBeInTheDocument();
  });
});
