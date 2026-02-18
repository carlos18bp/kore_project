import { render, screen, waitFor } from '@testing-library/react';
import AppLayout from '@/app/(app)/layout';
import { useAuthStore } from '@/lib/stores/authStore';

const mockPush = jest.fn();

jest.mock('next/navigation', () => ({
  usePathname: () => '/dashboard',
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

describe('AppLayout', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useAuthStore.setState({
      user: null,
      accessToken: null,
      isAuthenticated: false,
      hydrated: true,
    });
  });

  it('renders Sidebar and children when authenticated', () => {
    useAuthStore.setState({ user: mockUser, isAuthenticated: true, accessToken: 'token', hydrated: true });
    render(
      <AppLayout>
        <div data-testid="child-content">Dashboard content</div>
      </AppLayout>
    );

    expect(screen.getByText('KÓRE')).toBeInTheDocument();
    expect(screen.getByTestId('child-content')).toBeInTheDocument();
  });

  it('redirects to /login when hydrated and not authenticated', async () => {
    useAuthStore.setState({ user: null, isAuthenticated: false, accessToken: null, hydrated: true });
    render(
      <AppLayout>
        <div>Content</div>
      </AppLayout>
    );

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/login');
    });
  });

  it('does not redirect when authenticated', () => {
    useAuthStore.setState({ user: mockUser, isAuthenticated: true, accessToken: 'token', hydrated: true });
    render(
      <AppLayout>
        <div>Content</div>
      </AppLayout>
    );

    expect(mockPush).not.toHaveBeenCalledWith('/login');
  });

});
