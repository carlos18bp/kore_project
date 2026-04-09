import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TrainerMobileBottomNav from '@/app/components/layouts/TrainerMobileBottomNav';
import { useAuthStore } from '@/lib/stores/authStore';

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

describe('TrainerMobileBottomNav', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPathname = '/trainer/dashboard';
    useAuthStore.setState({ logout: jest.fn() });
  });

  it('renders Inicio link to /trainer/dashboard', () => {
    render(<TrainerMobileBottomNav />);
    expect(screen.getByText('Inicio').closest('a')).toHaveAttribute('href', '/trainer/dashboard');
  });

  it('renders Clientes link to /trainer/clients', () => {
    render(<TrainerMobileBottomNav />);
    expect(screen.getByText('Clientes').closest('a')).toHaveAttribute('href', '/trainer/clients');
  });

  it('renders Más button in the tab bar', () => {
    render(<TrainerMobileBottomNav />);
    expect(screen.getByRole('button', { name: /Más/i })).toBeInTheDocument();
  });

  it('highlights Inicio link when pathname is /trainer/dashboard', () => {
    mockPathname = '/trainer/dashboard';
    render(<TrainerMobileBottomNav />);
    expect(screen.getByText('Inicio').closest('a')).toHaveClass('text-kore-red');
  });

  it('highlights Clientes link when pathname starts with /trainer/clients', () => {
    mockPathname = '/trainer/clients/42';
    render(<TrainerMobileBottomNav />);
    expect(screen.getByText('Clientes').closest('a')).toHaveClass('text-kore-red');
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
    expect(masButton).toHaveClass('text-kore-red');
  });

  it('calls logout when Cerrar sesión is clicked', async () => {
    const mockLogout = jest.fn();
    useAuthStore.setState({ logout: mockLogout });
    const user = userEvent.setup();
    render(<TrainerMobileBottomNav />);
    await user.click(screen.getByRole('button', { name: /Más/i }));
    await user.click(screen.getByText('Cerrar sesión'));
    expect(mockLogout).toHaveBeenCalledTimes(1);
  });

  it('navigates to / when Cerrar sesión is clicked', async () => {
    const user = userEvent.setup();
    render(<TrainerMobileBottomNav />);
    await user.click(screen.getByRole('button', { name: /Más/i }));
    await user.click(screen.getByText('Cerrar sesión'));
    expect(mockPush).toHaveBeenCalledWith('/');
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
