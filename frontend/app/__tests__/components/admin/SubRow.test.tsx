import { render, screen, within } from '@testing-library/react';
import SubRow, { type AdminSubRowData } from '@/app/components/admin/SubRow';

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

function makeSub(overrides: Partial<AdminSubRowData> = {}): AdminSubRowData {
  return {
    id: 7,
    customer_id: 100,
    customer_name: 'Ana Ruiz',
    customer_email: 'ana@example.com',
    package: { title: 'Plan Personalizado', category: 'personalizado' },
    status: 'active',
    starts_at: '2026-01-01T00:00:00Z',
    expires_at: '2026-06-01T00:00:00Z',
    sessions_used: 4,
    sessions_total: 12,
    is_duo: false,
    guest_info: null,
    ...overrides,
  };
}

/** El componente renderiza dos bloques; las aserciones se acotan al bloque card. */
function card() {
  return within(screen.getByTestId('subrow-card'));
}

afterEach(() => {
  jest.clearAllMocks();
});

describe('SubRow', () => {
  it('renders both a desktop block and a card block', () => {
    render(<SubRow sub={makeSub()} />);
    expect(screen.getByTestId('subrow-desktop')).toBeInTheDocument();
    expect(screen.getByTestId('subrow-card')).toBeInTheDocument();
  });

  it('renders the customer name', () => {
    render(<SubRow sub={makeSub()} />);
    expect(card().getByText('Ana Ruiz')).toBeInTheDocument();
  });

  it('renders the package title', () => {
    render(<SubRow sub={makeSub()} />);
    expect(card().getByText('Plan Personalizado')).toBeInTheDocument();
  });

  it('renders session counts', () => {
    render(<SubRow sub={makeSub({ sessions_used: 4, sessions_total: 12 })} />);
    expect(card().getByText('4')).toBeInTheDocument();
    expect(card().getByText('/ 12')).toBeInTheDocument();
  });

  it('renders the status pill', () => {
    render(<SubRow sub={makeSub({ status: 'active' })} />);
    expect(card().getByText('Activa')).toBeInTheDocument();
  });

  it('renders the customer email for a non-duo subscription', () => {
    render(<SubRow sub={makeSub({ is_duo: false })} />);
    expect(card().getByText('ana@example.com')).toBeInTheDocument();
  });

  it('renders a link to the subscription detail page using sub.id', () => {
    render(<SubRow sub={makeSub({ id: 7 })} />);
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', '/admin-platform/subscriptions/detail?id=7');
  });
});
