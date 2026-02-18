import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ProgramsPage from '@/app/(public)/programs/page';
import { api } from '@/lib/services/http';
import { useAuthStore } from '@/lib/stores/authStore';

const mockPush = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

jest.mock('next/image', () => ({
  __esModule: true,
  default: (props: React.ImgHTMLAttributes<HTMLImageElement>) => <img {...props} />,
}));

jest.mock('@/lib/services/http', () => ({
  api: { get: jest.fn(), post: jest.fn() },
}));

const mockedApi = api as jest.Mocked<typeof api>;

const MOCK_PACKAGES = {
  results: [
    { id: 1, title: 'Sesión Individual', category: 'personalizado', sessions_count: 1, session_duration_minutes: 60, price: '85000.00', currency: 'COP', validity_days: 30 },
    { id: 2, title: 'Programa Básico', category: 'personalizado', sessions_count: 4, session_duration_minutes: 60, price: '320000.00', currency: 'COP', validity_days: 30 },
    { id: 3, title: 'Programa Integral', category: 'personalizado', sessions_count: 20, session_duration_minutes: 60, price: '1200000.00', currency: 'COP', validity_days: 90 },
    { id: 10, title: 'Programa Inicial', category: 'semi_personalizado', sessions_count: 4, session_duration_minutes: 60, price: '240000.00', currency: 'COP', validity_days: 30 },
    { id: 20, title: 'Sesión Terapéutica', category: 'terapeutico', sessions_count: 1, session_duration_minutes: 60, price: '95000.00', currency: 'COP', validity_days: 30 },
  ],
};

describe('ProgramsPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedApi.get.mockResolvedValue({ data: MOCK_PACKAGES });
    useAuthStore.setState({
      user: null,
      accessToken: null,
      isAuthenticated: false,
      hydrated: true,
    });
  });

  it('renders the tariff badge', async () => {
    render(<ProgramsPage />);
    expect(screen.getByText('Tarifas 2026')).toBeInTheDocument();
  });

  it('shows Personalizado program by default', async () => {
    render(<ProgramsPage />);
    expect(screen.getByText('Personalizado FLW')).toBeInTheDocument();
    expect(screen.getByText('Tu proceso, tu ritmo')).toBeInTheDocument();
  });

  it('fetches packages from API on mount', async () => {
    render(<ProgramsPage />);
    await waitFor(() => {
      expect(mockedApi.get).toHaveBeenCalledWith('/packages/');
    });
  });

  it('renders plan options from API data for the default program', async () => {
    render(<ProgramsPage />);
    await waitFor(() => {
      expect(screen.getByText('Sesión Individual')).toBeInTheDocument();
    });
    expect(screen.getByText('Programa Básico')).toBeInTheDocument();
    expect(screen.getByText('Programa Integral')).toBeInTheDocument();
  });

  it('switches to Semi-personalizado when tab is clicked', async () => {
    render(<ProgramsPage />);
    await waitFor(() => {
      expect(screen.getByText('Sesión Individual')).toBeInTheDocument();
    });

    const user = userEvent.setup();
    const semiButton = screen.getAllByText('Semi-personalizado')[0];
    await user.click(semiButton.closest('button')!);

    expect(screen.getByText('Semi-personalizado FLW')).toBeInTheDocument();
    expect(screen.getByText('Comparte el camino')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText('Programa Inicial')).toBeInTheDocument();
    });
  });

  it('switches to Terapéutico when tab is clicked', async () => {
    render(<ProgramsPage />);
    await waitFor(() => {
      expect(screen.getByText('Sesión Individual')).toBeInTheDocument();
    });

    const user = userEvent.setup();
    const terapeuticoButton = screen.getAllByText('Terapéutico')[0];
    await user.click(terapeuticoButton.closest('button')!);

    expect(screen.getByText('Terapéutico FLW')).toBeInTheDocument();
    expect(screen.getByText('Movimiento como medicina')).toBeInTheDocument();
  });

  it('navigates to register with numeric package ID when unauthenticated', async () => {
    render(<ProgramsPage />);
    await waitFor(() => {
      expect(screen.getByText('Sesión Individual')).toBeInTheDocument();
    });

    const user = userEvent.setup();
    const planButton = screen.getByText('Sesión Individual').closest('button')!;
    await user.click(planButton);

    const cta = screen.getByRole('button', { name: /Reservar Sesión Individual/ });
    expect(cta).toBeInTheDocument();
    await user.click(cta);
    expect(mockPush).toHaveBeenCalledWith('/register?package=1');
  });

  it('navigates to checkout with numeric package ID when authenticated', async () => {
    useAuthStore.setState({
      user: {
        id: '1',
        email: 'customer@kore.com',
        first_name: 'Customer',
        last_name: 'Kore',
        phone: '',
        role: 'customer',
        name: 'Customer Kore',
      },
      accessToken: 'token',
      isAuthenticated: true,
      hydrated: true,
    });

    render(<ProgramsPage />);
    await waitFor(() => {
      expect(screen.getByText('Sesión Individual')).toBeInTheDocument();
    });

    const user = userEvent.setup();
    const planButton = screen.getByText('Sesión Individual').closest('button')!;
    await user.click(planButton);

    const cta = screen.getByRole('button', { name: /Reservar Sesión Individual/ });
    await user.click(cta);
    expect(mockPush).toHaveBeenCalledWith('/checkout?package=1');
  });

  it('resets plan selection when switching programs', async () => {
    render(<ProgramsPage />);
    await waitFor(() => {
      expect(screen.getByText('Sesión Individual')).toBeInTheDocument();
    });

    const user = userEvent.setup();
    await user.click(screen.getByText('Sesión Individual').closest('button')!);
    expect(screen.getByText(/Reservar Sesión Individual/)).toBeInTheDocument();

    // Switch to Semi-personalizado
    await user.click(screen.getAllByText('Semi-personalizado')[0].closest('button')!);

    // CTA should no longer show the Personalizado plan
    expect(screen.queryByText(/Reservar Sesión Individual/)).not.toBeInTheDocument();
  });

  it('formats prices correctly', async () => {
    render(<ProgramsPage />);
    await waitFor(() => {
      expect(screen.getByText('$85,000')).toBeInTheDocument();
    });
  });

  it('shows session pluralization correctly', async () => {
    render(<ProgramsPage />);
    await waitFor(() => {
      expect(screen.getByText(/1 sesión/)).toBeInTheDocument();
    });
    expect(screen.getAllByText(/sesiones/).length).toBeGreaterThan(0);
  });

  it('shows empty state when API returns no packages for a category', async () => {
    mockedApi.get.mockResolvedValue({ data: { results: [] } });
    render(<ProgramsPage />);
    await waitFor(() => {
      expect(screen.getByText('No hay planes disponibles para este programa.')).toBeInTheDocument();
    });
  });

  it('handles API error gracefully', async () => {
    mockedApi.get.mockRejectedValue(new Error('Network error'));
    render(<ProgramsPage />);
    await waitFor(() => {
      expect(screen.getByText('No hay planes disponibles para este programa.')).toBeInTheDocument();
    });
  });
});
