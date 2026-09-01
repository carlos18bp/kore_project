import { render, screen } from '@testing-library/react';
import SubCardCompact, {
  type UserSubscriptionEntry,
} from '@/app/components/admin/SubCardCompact';

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

function makeSub(overrides: Partial<UserSubscriptionEntry> = {}): UserSubscriptionEntry {
  return {
    id: 77,
    package: { title: 'Plan Pareja', category: 'semi_personalizado' },
    status: 'active',
    starts_at: '2026-06-01T00:00:00Z',
    expires_at: '2026-07-30T00:00:00Z',
    sessions_used: 3,
    sessions_total: 12,
    role: 'individual',
    ...overrides,
  };
}

afterEach(() => {
  jest.clearAllMocks();
});

describe('SubCardCompact', () => {
  it('links to the subscription detail page using the sub id', () => {
    render(<SubCardCompact sub={makeSub({ id: 77 })} />);
    expect(screen.getByRole('link')).toHaveAttribute(
      'href',
      '/admin-platform/subscriptions/detail?id=77',
    );
  });

  it('prefixes the expiry date with vence for an active subscription', () => {
    render(<SubCardCompact sub={makeSub({ status: 'active' })} />);
    // The info line renders once per layout (desktop row + mobile card).
    expect(screen.getAllByText(/· vence /)[0]).toBeInTheDocument();
  });

  it('prefixes the expiry date with venció for an expired subscription', () => {
    render(<SubCardCompact sub={makeSub({ status: 'expired' })} />);
    expect(screen.getAllByText(/· venció /)[0]).toBeInTheDocument();
  });
});
