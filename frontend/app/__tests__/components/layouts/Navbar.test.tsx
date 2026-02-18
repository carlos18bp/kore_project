import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Navbar from '@/app/components/layouts/Navbar';
import { useAuthStore } from '@/lib/stores/authStore';

jest.mock('next/image', () => ({
  __esModule: true,
  default: (props: React.ImgHTMLAttributes<HTMLImageElement>) => <img {...props} />,
}));

let mockPathname = '/';
jest.mock('next/navigation', () => ({
  usePathname: () => mockPathname,
}));

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href, ...rest }: { children: React.ReactNode; href: string; onClick?: () => void }) => (
    <a href={href} {...rest}>{children}</a>
  ),
}));

describe('Navbar', () => {
  beforeEach(() => {
    mockPathname = '/';
    useAuthStore.setState({
      user: null,
      accessToken: null,
      isAuthenticated: false,
      hydrated: true,
      justLoggedIn: false,
    });
  });

  it('renders the brand logo and name', () => {
    render(<Navbar />);
    expect(screen.getByAltText('KÓRE')).toBeInTheDocument();
    expect(screen.getByText('KÓRE')).toBeInTheDocument();
  });

  it('renders navigation links', () => {
    render(<Navbar />);
    expect(screen.getAllByText('Inicio').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('La Marca').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Programas').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('FAQ').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Contacto').length).toBeGreaterThanOrEqual(1);
  });

  it('renders the login CTA button', () => {
    render(<Navbar />);
    expect(screen.getAllByText('Iniciar sesión').length).toBeGreaterThanOrEqual(1);
  });

  it('renders the dashboard CTA button when authenticated', () => {
    useAuthStore.setState({
      user: { id: '1', email: 'auth@kore.com', first_name: 'Auth', last_name: 'User', phone: '', role: 'customer', name: 'Auth User' },
      accessToken: 'token',
      isAuthenticated: true,
      hydrated: true,
      justLoggedIn: false,
    });
    render(<Navbar />);
    const ctaLink = screen.getAllByText('Mi sesión')[0].closest('a');
    expect(ctaLink).toHaveAttribute('href', '/dashboard');
  });

  it('toggles mobile menu on button click', async () => {
    render(<Navbar />);
    const user = userEvent.setup();
    const menuButton = screen.getByLabelText('Menú');

    // Mobile menu should be collapsed initially (max-h-0)
    const mobileMenu = menuButton.closest('nav')!.querySelector('.md\\:hidden.overflow-hidden');
    expect(mobileMenu).toHaveClass('max-h-0');

    await user.click(menuButton);

    expect(mobileMenu).toHaveClass('max-h-80');
  });

  it('closes mobile menu when a mobile link is clicked', async () => {
    render(<Navbar />);
    const user = userEvent.setup();
    const menuButton = screen.getByLabelText('Menú');
    const mobileMenu = menuButton.closest('nav')!.querySelector('.md\\:hidden.overflow-hidden');

    await user.click(menuButton);
    expect(mobileMenu).toHaveClass('max-h-80');

    // Click a mobile nav link
    const mobileLinks = mobileMenu!.querySelectorAll('a');
    await user.click(mobileLinks[0]);
    expect(mobileMenu).toHaveClass('max-h-0');
  });

  it('closes mobile menu when mobile login link is clicked', async () => {
    render(<Navbar />);
    const user = userEvent.setup();
    const menuButton = screen.getByLabelText('Menú');
    const mobileMenu = menuButton.closest('nav')!.querySelector('.md\\:hidden.overflow-hidden');

    await user.click(menuButton);
    expect(mobileMenu).toHaveClass('max-h-80');

    // Click the mobile "Iniciar sesión" link (last link in mobile menu)
    const mobileLinks = mobileMenu!.querySelectorAll('a');
    const loginLink = Array.from(mobileLinks).find(a => a.textContent === 'Iniciar sesión');
    expect(loginLink).toBeDefined();
    await user.click(loginLink!);
    expect(mobileMenu).toHaveClass('max-h-0');
  });

  it('highlights the active link based on pathname', () => {
    mockPathname = '/kore-brand';
    render(<Navbar />);

    // The desktop nav links
    const desktopLinks = screen.getAllByText('La Marca');
    const desktopLink = desktopLinks.find(el => el.closest('.hidden.md\\:flex'));
    expect(desktopLink).toHaveClass('text-kore-red');
  });
});
