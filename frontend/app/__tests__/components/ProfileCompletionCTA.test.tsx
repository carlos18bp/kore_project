import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ProfileCompletionCTA from '@/app/components/profile/ProfileCompletionCTA';
import { useAuthStore } from '@/lib/stores/authStore';
import { useProfileStore } from '@/lib/stores/profileStore';

const mockPush = jest.fn();
let mockPathname = '/dashboard';

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  usePathname: () => mockPathname,
}));

jest.mock('next/image', () => ({
  __esModule: true,
  default: (props: React.ImgHTMLAttributes<HTMLImageElement>) => <img {...props} />,
}));

jest.mock('@/lib/stores/authStore', () => ({
  useAuthStore: jest.fn(),
}));

jest.mock('@/lib/stores/profileStore', () => ({
  useProfileStore: jest.fn(),
}));

const mockedUseAuthStore = useAuthStore as unknown as jest.Mock;
const mockedUseProfileStore = useProfileStore as unknown as jest.Mock;

function setupStores(overrides: {
  auth?: Record<string, unknown>;
  profile?: Record<string, unknown>;
} = {}) {
  const mockFetchProfile = jest.fn();

  mockedUseAuthStore.mockReturnValue({
    user: { id: '1', first_name: 'Carlos', last_name: 'Test', profile_completed: false },
    hydrated: true,
    ...overrides.auth,
  });

  mockedUseProfileStore.mockReturnValue({
    profile: {
      customer_profile: {
        profile_completed: false,
        sex: null,
        date_of_birth: null,
        city: null,
        primary_goal: null,
      },
    },
    fetchProfile: mockFetchProfile,
    ...overrides.profile,
  });

  return { mockFetchProfile };
}

describe('ProfileCompletionCTA', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPathname = '/dashboard';
  });

  it('renders nothing when user is not hydrated', () => {
    setupStores({ auth: { hydrated: false, user: null } });
    const { container } = render(<ProfileCompletionCTA />);
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when user is null', () => {
    setupStores({ auth: { user: null } });
    const { container } = render(<ProfileCompletionCTA />);
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when profile is already completed', () => {
    setupStores({
      profile: {
        profile: {
          customer_profile: { profile_completed: true, sex: 'masculino', date_of_birth: '1990-01-01', city: 'Bogotá', primary_goal: 'fat_loss' },
        },
      },
    });
    const { container } = render(<ProfileCompletionCTA />);
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when already on /profile page', () => {
    mockPathname = '/profile';
    setupStores();
    const { container } = render(<ProfileCompletionCTA />);
    expect(container.firstChild).toBeNull();
  });

  it('renders modal when profile is incomplete and not on /profile', () => {
    setupStores();
    render(<ProfileCompletionCTA />);

    expect(screen.getByText('Queremos conocerte mejor')).toBeInTheDocument();
    expect(screen.getByText('Completar mi perfil')).toBeInTheDocument();
  });

  it('shows missing fields list', () => {
    setupStores({
      auth: { user: { id: '1', first_name: '', last_name: '', profile_completed: false } },
    });
    render(<ProfileCompletionCTA />);

    expect(screen.getByText('Te falta completar:')).toBeInTheDocument();
    expect(screen.getByText('Nombre')).toBeInTheDocument();
    expect(screen.getByText('Apellido')).toBeInTheDocument();
    expect(screen.getByText('Sexo')).toBeInTheDocument();
    expect(screen.getByText('Fecha de nacimiento')).toBeInTheDocument();
    expect(screen.getByText('Ciudad')).toBeInTheDocument();
    expect(screen.getByText('Objetivo principal')).toBeInTheDocument();
  });

  it('does not show missing fields that are already filled', () => {
    setupStores({
      auth: { user: { id: '1', first_name: 'Carlos', last_name: 'Test' } },
      profile: {
        profile: {
          customer_profile: {
            profile_completed: false,
            sex: 'masculino',
            date_of_birth: '1990-01-01',
            city: null,
            primary_goal: null,
          },
        },
      },
    });
    render(<ProfileCompletionCTA />);

    expect(screen.queryByText('Nombre')).not.toBeInTheDocument();
    expect(screen.queryByText('Apellido')).not.toBeInTheDocument();
    expect(screen.queryByText('Sexo')).not.toBeInTheDocument();
    expect(screen.getByText('Ciudad')).toBeInTheDocument();
    expect(screen.getByText('Objetivo principal')).toBeInTheDocument();
  });

  it('navigates to /profile when "Completar mi perfil" is clicked', () => {
    setupStores();
    render(<ProfileCompletionCTA />);

    fireEvent.click(screen.getByRole('button', { name: /Completar mi perfil/i }));

    expect(mockPush).toHaveBeenCalledWith('/profile');
  });

  it('shows loading state after clicking navigate button', () => {
    setupStores();
    render(<ProfileCompletionCTA />);

    fireEvent.click(screen.getByRole('button', { name: /Completar mi perfil/i }));

    expect(screen.getByText('Cargando...')).toBeInTheDocument();
    expect(screen.queryByText('Ahora no')).not.toBeInTheDocument();
  });

  it('dismisses modal when "Ahora no" is clicked', () => {
    setupStores();
    render(<ProfileCompletionCTA />);

    expect(screen.getByText('Queremos conocerte mejor')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Ahora no/i }));

    expect(screen.queryByText('Queremos conocerte mejor')).not.toBeInTheDocument();
  });

  it('dismisses modal when backdrop is clicked', () => {
    setupStores();
    render(<ProfileCompletionCTA />);

    expect(screen.getByText('Queremos conocerte mejor')).toBeInTheDocument();

    const backdrop = document.querySelector('.bg-black\\/40');
    if (backdrop) fireEvent.click(backdrop);

    expect(screen.queryByText('Queremos conocerte mejor')).not.toBeInTheDocument();
  });

  it('hides modal when pathname changes to /profile', () => {
    setupStores();
    const { rerender } = render(<ProfileCompletionCTA />);

    expect(screen.getByText('Queremos conocerte mejor')).toBeInTheDocument();

    mockPathname = '/profile';
    rerender(<ProfileCompletionCTA />);

    expect(screen.queryByText('Queremos conocerte mejor')).not.toBeInTheDocument();
  });

  it('calls fetchProfile on mount', () => {
    const { mockFetchProfile } = setupStores();
    render(<ProfileCompletionCTA />);

    expect(mockFetchProfile).toHaveBeenCalled();
  });
});
