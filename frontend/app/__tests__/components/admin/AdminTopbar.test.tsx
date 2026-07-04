import { render, screen } from '@testing-library/react';
import AdminTopbar from '@/app/components/admin/AdminTopbar';

jest.mock('next/link', () => {
  const MockLink = ({
    href,
    children,
    ...props
  }: {
    href: string;
    children: React.ReactNode;
    [key: string]: unknown;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  );
  MockLink.displayName = 'MockLink';
  return MockLink;
});

afterEach(() => {
  jest.clearAllMocks();
});

describe('AdminTopbar', () => {
  it('renders the page title as a heading', () => {
    render(<AdminTopbar title="Resumen" />);
    expect(screen.getByRole('heading', { name: 'Resumen' })).toBeInTheDocument();
  });

  it('renders the system status indicator', () => {
    render(<AdminTopbar title="Resumen" />);
    expect(screen.getByText('Sistema operativo')).toBeInTheDocument();
  });

  it('renders each breadcrumb label when a breadcrumb trail is provided', () => {
    render(
      <AdminTopbar
        title="Detalle"
        breadcrumb={[{ label: 'Panel', href: '/admin-platform/dashboard' }, { label: 'Usuarios' }]}
      />,
    );
    expect(screen.getByText('Panel')).toBeInTheDocument();
    expect(screen.getByText('Usuarios')).toBeInTheDocument();
  });

  it('renders a breadcrumb crumb with href as a link to that route', () => {
    render(
      <AdminTopbar title="Detalle" breadcrumb={[{ label: 'Panel', href: '/admin-platform/dashboard' }]} />,
    );
    expect(screen.getByRole('link', { name: 'Panel' })).toHaveAttribute(
      'href',
      '/admin-platform/dashboard',
    );
  });

  it('renders a breadcrumb crumb without href as plain text, not a link', () => {
    render(<AdminTopbar title="Detalle" breadcrumb={[{ label: 'Usuarios' }]} />);
    expect(screen.queryByRole('link', { name: 'Usuarios' })).not.toBeInTheDocument();
    expect(screen.getByText('Usuarios')).toBeInTheDocument();
  });

  it('renders no breadcrumb links when the trail is empty', () => {
    render(<AdminTopbar title="Resumen" breadcrumb={[]} />);
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });
});
