import { render, screen, within } from '@testing-library/react';
import UserRow, { type AdminUserRowData } from '@/app/components/admin/UserRow';

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

/** El componente renderiza dos bloques; las aserciones se acotan al bloque card. */
function card() {
  return within(screen.getByTestId('userrow-card'));
}

afterEach(() => {
  jest.clearAllMocks();
});

describe('UserRow', () => {
  it('renders both a desktop block and a card block', () => {
    render(<UserRow user={makeUser()} />);
    expect(screen.getByTestId('userrow-desktop')).toBeInTheDocument();
    expect(screen.getByTestId('userrow-card')).toBeInTheDocument();
  });

  it('renders the user full name', () => {
    render(<UserRow user={makeUser()} />);
    expect(card().getByText('Carlos López')).toBeInTheDocument();
  });

  it('renders the user email', () => {
    render(<UserRow user={makeUser()} />);
    expect(card().getByText('user@example.com')).toBeInTheDocument();
  });

  it('shows "Entrenador" pill when role is trainer', () => {
    render(<UserRow user={makeUser({ role: 'trainer' })} />);
    expect(card().getByText('Entrenador')).toBeInTheDocument();
  });

  it('shows "Cliente" pill when role is customer', () => {
    render(<UserRow user={makeUser({ role: 'customer' })} />);
    expect(card().getByText('Cliente')).toBeInTheDocument();
  });

  it('renders a "!" badge when must_change_password is true', () => {
    render(<UserRow user={makeUser({ must_change_password: true })} />);
    expect(card().getByTitle('Debe cambiar contraseña')).toBeInTheDocument();
    expect(card().getByText('!')).toBeInTheDocument();
  });

  it('does not render a "!" badge when must_change_password is false', () => {
    render(<UserRow user={makeUser({ must_change_password: false })} />);
    expect(card().queryByText('!')).not.toBeInTheDocument();
  });

  it('renders session counts when sessions_total_total is greater than 0', () => {
    render(<UserRow user={makeUser({ sessions_used_total: 3, sessions_total_total: 10 })} />);
    expect(card().getByText('3')).toBeInTheDocument();
    expect(card().getByText('/ 10')).toBeInTheDocument();
  });

  it('renders "Sin plan" when sessions_total_total is 0', () => {
    render(<UserRow user={makeUser({ sessions_total_total: 0 })} />);
    expect(card().getByText('Sin plan')).toBeInTheDocument();
  });

  it('shows "Activo" pill when is_active is true', () => {
    render(<UserRow user={makeUser({ is_active: true })} />);
    expect(card().getByText('Activo')).toBeInTheDocument();
  });

  it('shows "Inactivo" pill when is_active is false', () => {
    render(<UserRow user={makeUser({ is_active: false })} />);
    expect(card().getByText('Inactivo')).toBeInTheDocument();
  });

  it('renders a link to the user detail page using user.id', () => {
    render(<UserRow user={makeUser({ id: 42 })} />);
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', '/admin-platform/users/detail?id=42');
  });

  it('shows "Sin actividad" when last_login is null', () => {
    render(<UserRow user={makeUser({ last_login: null })} />);
    expect(card().getByText('Sin actividad')).toBeInTheDocument();
  });

  describe('last login relative time', () => {
    beforeEach(() => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2026-07-22T12:00:00Z'));
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    test.each([
      ['2026-07-22T11:30:00Z', 'Hace 30 min'],
      ['2026-07-22T07:00:00Z', 'Hace 5 h'],
      ['2026-07-19T12:00:00Z', 'Hace 3 d'],
    ])('shows a login at %s as "%s"', (lastLogin, expected) => {
      render(<UserRow user={makeUser({ last_login: lastLogin })} />);
      expect(card().getByText(expected)).toBeInTheDocument();
    });
  });
});
