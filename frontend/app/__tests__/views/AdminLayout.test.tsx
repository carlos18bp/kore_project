import { render, screen } from '@testing-library/react';
import AdminLayout from '@/app/admin-platform/layout';
import { useAuthStore, SPLASH_SHOWN_KEY } from '@/lib/stores/authStore';

jest.mock('next/navigation', () => ({
  usePathname: () => '/admin-platform/dashboard',
  useRouter: () => ({ replace: jest.fn() }),
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

jest.mock('js-cookie', () => ({
  get: jest.fn(),
  set: jest.fn(),
  remove: jest.fn(),
}));

const adminUser = {
  id: '1',
  email: 'admin@kore.com',
  first_name: 'Admin',
  last_name: 'Kore',
  phone: '',
  role: 'admin',
  name: 'Admin Kore',
  must_change_password: false,
};

describe('AdminLayout — mobile nav wiring', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    sessionStorage.clear();
    sessionStorage.setItem(SPLASH_SHOWN_KEY, '1');
    useAuthStore.setState({
      user: adminUser,
      isAuthenticated: true,
      accessToken: 'token',
      hydrated: true,
      hydrate: jest.fn(),
      logout: jest.fn(),
    });
  });

  it('renders AdminMobileBottomNav alongside children for an admin user', () => {
    render(
      <AdminLayout>
        <div data-testid="admin-child">contenido</div>
      </AdminLayout>,
    );
    expect(screen.getByTestId('admin-child')).toBeInTheDocument();
    expect(screen.getByText('Panel')).toBeInTheDocument();
    expect(screen.getByText('Suscrip.')).toBeInTheDocument();
  });
});
