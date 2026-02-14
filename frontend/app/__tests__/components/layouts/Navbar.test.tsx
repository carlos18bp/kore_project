import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Navbar from '@/app/components/layouts/Navbar';

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
  });

  it('renders the brand logo and name', () => {
    render(<Navbar />);
    expect(screen.getByAltText('KÓRE')).toBeInTheDocument();
    expect(screen.getByText('KÓRE')).toBeInTheDocument();
  });

  it('renders navigation links', () => {
    render(<Navbar />);
    expect(screen.getAllByText('Inicio').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('La Marca Kóre').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Programas').length).toBeGreaterThanOrEqual(1);
  });

  it('renders the login CTA button', () => {
    render(<Navbar />);
    expect(screen.getAllByText('Iniciar sesión').length).toBeGreaterThanOrEqual(1);
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

  it('highlights the active link based on pathname', () => {
    mockPathname = '/la-marca-kore';
    render(<Navbar />);

    // The desktop nav links
    const desktopLinks = screen.getAllByText('La Marca Kóre');
    const desktopLink = desktopLinks.find(el => el.closest('.hidden.md\\:flex'));
    expect(desktopLink).toHaveClass('text-kore-red');
  });
});
