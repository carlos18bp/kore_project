import { render, screen, fireEvent } from '@testing-library/react';
import TrainerSidebar from '@/app/components/layouts/TrainerSidebar';
import { useAuthStore } from '@/lib/stores/authStore';

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

const mockedUseAuthStore = useAuthStore as unknown as jest.Mock;

function setupStore(overrides: Record<string, unknown> = {}) {
  const mockLogout = jest.fn();
  mockedUseAuthStore.mockReturnValue({
    user: { name: 'Trainer Carlos', email: 'trainer@kore.com' },
    logout: mockLogout,
    ...overrides,
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

  it('renders Inicio and Mis Clientes nav items', () => {
    setupStore();
    render(<TrainerSidebar />);

    expect(screen.getByText('Inicio')).toBeInTheDocument();
    expect(screen.getByText('Mis Clientes')).toBeInTheDocument();
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

  it('opens mobile menu when hamburger is clicked', () => {
    setupStore();
    render(<TrainerSidebar />);

    const hamburger = screen.getByLabelText('Abrir menú');
    fireEvent.click(hamburger);

    const backdrop = document.querySelector('.bg-black\\/30');
    expect(backdrop).toBeInTheDocument();
  });

  it('closes mobile menu when close button is clicked', () => {
    setupStore();
    render(<TrainerSidebar />);

    fireEvent.click(screen.getByLabelText('Abrir menú'));
    expect(document.querySelector('.bg-black\\/30')).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Cerrar menú'));
    expect(document.querySelector('.bg-black\\/30')).not.toBeInTheDocument();
  });

  it('closes mobile menu when backdrop is clicked', () => {
    setupStore();
    render(<TrainerSidebar />);

    fireEvent.click(screen.getByLabelText('Abrir menú'));
    const backdrop = document.querySelector('.bg-black\\/30');
    expect(backdrop).toBeInTheDocument();

    fireEvent.click(backdrop!);
    expect(document.querySelector('.bg-black\\/30')).not.toBeInTheDocument();
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
});
