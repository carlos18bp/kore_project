import { render, screen } from '@testing-library/react';
import MemberCard, {
  NoGuestCard,
  PendingMemberCard,
  RevokedMemberCard,
} from '@/app/components/admin/MemberCard';

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

describe('MemberCard', () => {
  it('renders the member role label', () => {
    render(<MemberCard role="Anfitrión" name="Ana Ruiz" email="ana@example.com" />);
    expect(screen.getByText('Anfitrión')).toBeInTheDocument();
  });

  it('renders the member name', () => {
    render(<MemberCard role="Cliente" name="Ana Ruiz" email="ana@example.com" />);
    expect(screen.getByText('Ana Ruiz')).toBeInTheDocument();
  });

  it('renders the member email', () => {
    render(<MemberCard role="Cliente" name="Ana Ruiz" email="ana@example.com" />);
    expect(screen.getByText('ana@example.com')).toBeInTheDocument();
  });

  it('links to the user detail page when a userId is provided', () => {
    render(<MemberCard role="Cliente" name="Ana Ruiz" email="ana@example.com" userId={55} />);
    expect(screen.getByRole('link')).toHaveAttribute(
      'href',
      '/admin-platform/users/detail?id=55',
    );
  });

  it('renders no link when userId is absent', () => {
    render(<MemberCard role="Cliente" name="Ana Ruiz" email="ana@example.com" />);
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });
});

describe('PendingMemberCard', () => {
  it('renders the pending invitation label', () => {
    render(<PendingMemberCard email="guest@example.com" />);
    expect(screen.getByText('Invitación pendiente')).toBeInTheDocument();
  });

  it('renders the invited email', () => {
    render(<PendingMemberCard email="guest@example.com" />);
    expect(screen.getByText('guest@example.com')).toBeInTheDocument();
  });
});

describe('RevokedMemberCard', () => {
  it('renders the revoked invitation label', () => {
    render(<RevokedMemberCard name="Pedro Gómez" />);
    expect(screen.getByText('Invitación revocada')).toBeInTheDocument();
  });

  it('renders the revoked member name', () => {
    render(<RevokedMemberCard name="Pedro Gómez" />);
    expect(screen.getByText('Pedro Gómez')).toBeInTheDocument();
  });
});

describe('NoGuestCard', () => {
  it('renders the no invitation label', () => {
    render(<NoGuestCard />);
    expect(screen.getByText('Sin invitación')).toBeInTheDocument();
  });
});
