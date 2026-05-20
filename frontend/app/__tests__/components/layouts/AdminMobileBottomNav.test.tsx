import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AdminMobileBottomNav from '@/app/components/layouts/AdminMobileBottomNav';
import { useAuthStore } from '@/lib/stores/authStore';

let mockPathname = '/admin-platform/dashboard';

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

describe('AdminMobileBottomNav', () => {
  beforeEach(() => {
    mockPathname = '/admin-platform/dashboard';
    useAuthStore.setState({ logout: jest.fn() });
  });

  it('renders the 4 admin tabs and the "Más" trigger', () => {
    render(<AdminMobileBottomNav />);
    ['Panel', 'Usuarios', 'Suscrip.', 'Planes', 'Más'].forEach((label) =>
      expect(screen.getByText(label)).toBeInTheDocument(),
    );
  });

  it('highlights Panel only on the exact dashboard route', () => {
    mockPathname = '/admin-platform/dashboard';
    render(<AdminMobileBottomNav />);
    expect(screen.getByText('Panel').closest('a')).toHaveClass('text-kore-gold');
  });

  it('highlights Usuarios on a nested users route', () => {
    mockPathname = '/admin-platform/users/detail';
    render(<AdminMobileBottomNav />);
    expect(screen.getByText('Usuarios').closest('a')).toHaveClass('text-kore-gold');
  });

  it('shows Reportes (Pronto) and Cerrar sesión in the More sheet', async () => {
    render(<AdminMobileBottomNav />);
    await userEvent.click(screen.getByText('Más'));
    expect(screen.getByText('Reportes')).toBeInTheDocument();
    expect(screen.getByText('Pronto')).toBeInTheDocument();
    expect(screen.getByText('Cerrar sesión')).toBeInTheDocument();
  });
});
