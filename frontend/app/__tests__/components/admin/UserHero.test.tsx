import { render, screen } from '@testing-library/react';
import UserHero from '@/app/components/admin/UserHero';

type HeroProps = React.ComponentProps<typeof UserHero>;

function makeProps(overrides: Partial<HeroProps> = {}): HeroProps {
  return {
    id: 42,
    fullName: 'Carlos López',
    email: 'carlos@example.com',
    role: 'customer',
    isActive: true,
    ...overrides,
  };
}

afterEach(() => {
  jest.clearAllMocks();
});

describe('UserHero', () => {
  it('renders the user full name', () => {
    render(<UserHero {...makeProps()} />);
    expect(screen.getByText('Carlos López')).toBeInTheDocument();
  });

  it('renders the user email', () => {
    render(<UserHero {...makeProps({ email: 'carlos@example.com' })} />);
    expect(screen.getByText('carlos@example.com')).toBeInTheDocument();
  });

  it('renders the user id label', () => {
    render(<UserHero {...makeProps({ id: 42 })} />);
    expect(screen.getByText('Usuario #42')).toBeInTheDocument();
  });

  it('renders the "Cliente" pill when the role is customer', () => {
    render(<UserHero {...makeProps({ role: 'customer' })} />);
    expect(screen.getByText('♀ Cliente')).toBeInTheDocument();
  });

  it('renders the "Entrenador" pill when the role is trainer', () => {
    render(<UserHero {...makeProps({ role: 'trainer' })} />);
    expect(screen.getByText('✦ Entrenador')).toBeInTheDocument();
  });

  it('renders the "Activo" pill when the user is active', () => {
    render(<UserHero {...makeProps({ isActive: true })} />);
    expect(screen.getByText('● Activo')).toBeInTheDocument();
  });

  it('renders the "Inactivo" pill when the user is inactive', () => {
    render(<UserHero {...makeProps({ isActive: false })} />);
    expect(screen.getByText('● Inactivo')).toBeInTheDocument();
  });

  it('renders the joined label when provided', () => {
    render(<UserHero {...makeProps({ joinedLabel: '10 mar 2025' })} />);
    expect(screen.getByText('Miembro desde 10 mar 2025')).toBeInTheDocument();
  });

  it('renders the pending password badge when mustChangePassword is true', () => {
    render(<UserHero {...makeProps({ mustChangePassword: true })} />);
    expect(screen.getByTitle('Debe cambiar contraseña')).toBeInTheDocument();
  });

  it('does not render the pending password badge when mustChangePassword is false', () => {
    render(<UserHero {...makeProps({ mustChangePassword: false })} />);
    expect(screen.queryByTitle('Debe cambiar contraseña')).not.toBeInTheDocument();
  });
});
