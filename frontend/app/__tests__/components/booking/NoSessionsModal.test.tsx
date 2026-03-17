import { render, screen } from '@testing-library/react';
import NoSessionsModal from '@/app/components/booking/NoSessionsModal';

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href, ...rest }: { children: React.ReactNode; href: string }) => (
    <a href={href} {...rest}>{children}</a>
  ),
}));

describe('NoSessionsModal', () => {
  it('renders the modal overlay', () => {
    render(<NoSessionsModal />);
    expect(screen.getByText('Sin sesiones disponibles')).toBeInTheDocument();
  });

  it('renders exhaustion message', () => {
    render(<NoSessionsModal />);
    expect(screen.getByText(/Has utilizado todas las sesiones de tu programa/)).toBeInTheDocument();
  });

  it('renders renewal prompt', () => {
    render(<NoSessionsModal />);
    expect(screen.getByText(/adquiere un nuevo programa/)).toBeInTheDocument();
  });

  it('renders dashboard link with correct href', () => {
    render(<NoSessionsModal />);
    const dashLink = screen.getByRole('link', { name: /Volver al inicio/i });
    expect(dashLink).toHaveAttribute('href', '/dashboard');
  });

  it('renders subscription link with correct href', () => {
    render(<NoSessionsModal />);
    const subLink = screen.getByRole('link', { name: /Ver programas/i });
    expect(subLink).toHaveAttribute('href', '/subscription');
  });

  it('displays package title when provided', () => {
    render(<NoSessionsModal packageTitle="Plan Premium" />);
    expect(screen.getByText('Plan Premium')).toBeInTheDocument();
  });

  it('omits package title span when not provided', () => {
    render(<NoSessionsModal />);
    const message = screen.getByText(/Has utilizado todas las sesiones de tu programa/);
    expect(message.querySelector('.font-semibold')).toBeNull();
  });

  it('renders warning icon SVG', () => {
    const { container } = render(<NoSessionsModal />);
    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
  });
});
