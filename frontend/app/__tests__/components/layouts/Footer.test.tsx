import { render, screen } from '@testing-library/react';
import Footer from '@/app/components/layouts/Footer';

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href, ...rest }: { children: React.ReactNode; href: string }) => (
    <a href={href} {...rest}>{children}</a>
  ),
}));

describe('Footer', () => {
  beforeEach(() => {
    render(<Footer />);
  });

  it('renders navigation links', () => {
    expect(screen.getByText('Inicio')).toBeInTheDocument();
    expect(screen.getByText('La Marca')).toBeInTheDocument();
    expect(screen.getByText('Programas')).toBeInTheDocument();
  });

  it('renders social links', () => {
    expect(screen.getByText('Instagram')).toBeInTheDocument();
    expect(screen.getByText('Facebook')).toBeInTheDocument();
    expect(screen.getByText('WhatsApp')).toBeInTheDocument();
    expect(screen.getByText('contacto@kore.co')).toBeInTheDocument();
  });

  it('social links open in new tab', () => {
    const instagramLink = screen.getByText('Instagram').closest('a');
    expect(instagramLink).toHaveAttribute('target', '_blank');
    expect(instagramLink).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('renders the giant KÓRE brand text', () => {
    expect(screen.getByText('KÓRE')).toBeInTheDocument();
  });
});
