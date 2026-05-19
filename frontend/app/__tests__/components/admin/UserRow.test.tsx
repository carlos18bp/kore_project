import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import UserRow, { type AdminUserRowData } from '@/app/components/admin/UserRow';

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockPush = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

jest.mock('next/link', () => {
  const MockLink = ({ href, children, ...props }: { href: string; children: React.ReactNode; [key: string]: unknown }) => (
    <a href={href} {...props}>{children}</a>
  );
  MockLink.displayName = 'MockLink';
  return MockLink;
});

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeUser(overrides: Partial<AdminUserRowData> = {}): AdminUserRowData {
  return {
    id: 42,
    email: 'user@example.com',
    first_name: 'Carlos',
    last_name: 'López',
    full_name: 'Carlos López',
    role: 'customer',
    is_active: true,
    must_change_password: false,
    last_login: null,
    sessions_used_total: 0,
    sessions_total_total: 0,
    ...overrides,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

afterEach(() => {
  jest.clearAllMocks();
});

describe('UserRow', () => {
  it('renders the user full name', () => {
    render(<UserRow user={makeUser()} />);
    expect(screen.getByText('Carlos López')).toBeInTheDocument();
  });

  it('renders the user email', () => {
    render(<UserRow user={makeUser()} />);
    expect(screen.getByText('user@example.com')).toBeInTheDocument();
  });

  it('shows "Entrenador" pill when role is trainer', () => {
    render(<UserRow user={makeUser({ role: 'trainer' })} />);
    expect(screen.getByText('Entrenador')).toBeInTheDocument();
  });

  it('shows "Cliente" pill when role is customer', () => {
    render(<UserRow user={makeUser({ role: 'customer' })} />);
    expect(screen.getByText('Cliente')).toBeInTheDocument();
  });

  it('renders a "!" badge when must_change_password is true', () => {
    render(<UserRow user={makeUser({ must_change_password: true })} />);
    expect(screen.getByTitle('Debe cambiar contraseña')).toBeInTheDocument();
    expect(screen.getByText('!')).toBeInTheDocument();
  });

  it('does not render a "!" badge when must_change_password is false', () => {
    render(<UserRow user={makeUser({ must_change_password: false })} />);
    expect(screen.queryByText('!')).not.toBeInTheDocument();
  });

  it('renders a progress bar when sessions_total_total is greater than 0', () => {
    render(<UserRow user={makeUser({ sessions_used_total: 3, sessions_total_total: 10 })} />);
    // Progress bar wrapper — the track div with overflow-hidden
    const trackDiv = document.querySelector('.h-1.rounded-\\[3px\\]');
    expect(trackDiv).not.toBeNull();
  });

  it('renders session counts when sessions_total_total is greater than 0', () => {
    render(<UserRow user={makeUser({ sessions_used_total: 3, sessions_total_total: 10 })} />);
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('/ 10')).toBeInTheDocument();
  });

  it('renders "Sin plan" when sessions_total_total is 0', () => {
    render(<UserRow user={makeUser({ sessions_total_total: 0 })} />);
    expect(screen.getByText('Sin plan')).toBeInTheDocument();
  });

  it('shows "Activo" pill when is_active is true', () => {
    render(<UserRow user={makeUser({ is_active: true })} />);
    expect(screen.getByText('Activo')).toBeInTheDocument();
  });

  it('shows "Inactivo" pill when is_active is false', () => {
    render(<UserRow user={makeUser({ is_active: false })} />);
    expect(screen.getByText('Inactivo')).toBeInTheDocument();
  });

  it('renders a link to the user detail page using user.id', () => {
    render(<UserRow user={makeUser({ id: 42 })} />);
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', '/admin-platform/users/detail?id=42');
  });

  it('shows "Sin actividad" when last_login is null', () => {
    render(<UserRow user={makeUser({ last_login: null })} />);
    expect(screen.getByText('Sin actividad')).toBeInTheDocument();
  });
});
