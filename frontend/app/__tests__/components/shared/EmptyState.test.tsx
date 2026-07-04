import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import EmptyState from '@/app/components/shared/EmptyState';

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href, ...rest }: { children: React.ReactNode; href: string }) => (
    <a href={href} {...rest}>{children}</a>
  ),
}));

afterEach(() => {
  jest.useRealTimers();
  jest.clearAllMocks();
  localStorage.clear();
});

describe('EmptyState', () => {
  it('renders the title text', () => {
    render(<EmptyState title="Sin resultados" />);
    expect(screen.getByText('Sin resultados')).toBeInTheDocument();
  });

  it('renders the description when provided', () => {
    render(<EmptyState title="Sin resultados" description="Prueba otro filtro" />);
    expect(screen.getByText('Prueba otro filtro')).toBeInTheDocument();
  });

  it('does not render a description when none is provided', () => {
    render(<EmptyState title="Sin resultados" />);
    expect(screen.queryByText('Prueba otro filtro')).not.toBeInTheDocument();
  });

  it('renders the CTA as a link pointing to the given href', () => {
    render(<EmptyState title="Sin resultados" cta={{ label: 'Ir a paquetes', href: '/packages' }} />);
    expect(screen.getByRole('link', { name: 'Ir a paquetes' })).toHaveAttribute('href', '/packages');
  });

  it('renders the CTA as a button when no href is given', () => {
    render(<EmptyState title="Sin resultados" cta={{ label: 'Reintentar', onClick: jest.fn() }} />);
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument();
  });

  it('calls the CTA onClick handler when the button is clicked', async () => {
    const onClick = jest.fn();
    const user = userEvent.setup();
    render(<EmptyState title="Sin resultados" cta={{ label: 'Reintentar', onClick }} />);
    await user.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('renders a custom icon when supplied', () => {
    render(<EmptyState title="Sin resultados" icon={<span>custom-icon</span>} />);
    expect(screen.getByText('custom-icon')).toBeInTheDocument();
  });

  it('does not render a CTA when none is provided', () => {
    render(<EmptyState title="Sin resultados" />);
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
