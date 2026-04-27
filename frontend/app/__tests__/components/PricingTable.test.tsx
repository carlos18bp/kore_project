import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PricingTable from '@/app/components/PricingTable';
import { api } from '@/lib/services/http';

jest.mock('@/lib/services/http', () => ({ api: { get: jest.fn() } }));

const FAKE_PACKAGES = [
  { id: 1, title: 'Sesión Individual', category: 'personalizado', sessions_count: 1, session_duration_minutes: 60, price: '85000.00', currency: 'COP', is_active: true },
  { id: 2, title: 'Programa Básico', category: 'personalizado', sessions_count: 4, session_duration_minutes: 60, price: '320000.00', currency: 'COP', is_active: true },
  { id: 3, title: 'Programa Integral', category: 'personalizado', sessions_count: 20, session_duration_minutes: 60, price: '1200000.00', currency: 'COP', is_active: true },
  { id: 4, title: 'Programa Inicial', category: 'semi_personalizado', sessions_count: 4, session_duration_minutes: 60, price: '240000.00', currency: 'COP', is_active: true },
  { id: 5, title: 'Sesión Terapéutica', category: 'terapeutico', sessions_count: 1, session_duration_minutes: 60, price: '120000.00', currency: 'COP', is_active: true },
  { id: 6, title: 'Programa Terapéutico', category: 'terapeutico', sessions_count: 4, session_duration_minutes: 60, price: '400000.00', currency: 'COP', is_active: true },
];

const mockedApi = api as jest.Mocked<typeof api>;

describe('PricingTable', () => {
  beforeEach(() => {
    mockedApi.get.mockResolvedValue({ data: FAKE_PACKAGES });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('renders the section header', async () => {
    render(<PricingTable />);
    expect(screen.getByText('Tarifas 2026')).toBeInTheDocument();
    expect(screen.getByText('Invierte en tu salud')).toBeInTheDocument();
  });

  it('renders the three program tab buttons', async () => {
    render(<PricingTable />);
    expect(screen.getByRole('button', { name: 'Personalizado' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Pareja' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Terapéutico' })).toBeInTheDocument();
  });

  it('shows Personalizado plans after API load', async () => {
    render(<PricingTable />);
    await waitFor(() => {
      expect(screen.getByText('Personalizado FLW')).toBeInTheDocument();
      expect(screen.getByText('Sesión Individual')).toBeInTheDocument();
      expect(screen.getByText('Programa Integral')).toBeInTheDocument();
    });
  });

  it('switches to Pareja plans when tab is clicked', async () => {
    render(<PricingTable />);
    const user = userEvent.setup();

    await waitFor(() => expect(screen.getByText('Sesión Individual')).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: 'Pareja' }));

    expect(screen.getByText('Pareja FLW')).toBeInTheDocument();
    expect(screen.getByText('Programa Inicial')).toBeInTheDocument();
  });

  it('switches to Terapéutico plans when tab is clicked', async () => {
    render(<PricingTable />);
    const user = userEvent.setup();

    await waitFor(() => expect(screen.getByText('Sesión Individual')).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: 'Terapéutico' }));

    expect(screen.getByText('Terapéutico FLW')).toBeInTheDocument();
    expect(screen.getByText('Sesión Terapéutica')).toBeInTheDocument();
  });

  it('shows "Más elegido" badge on the middle plan', async () => {
    render(<PricingTable />);
    await waitFor(() => expect(screen.getByText('Más elegido')).toBeInTheDocument());
  });

  it('shows correct pluralization for sessions (singular vs plural)', async () => {
    render(<PricingTable />);
    await waitFor(() => {
      expect(screen.getByText('sesión')).toBeInTheDocument();
      expect(screen.getAllByText('sesiones').length).toBeGreaterThan(0);
    });
  });

  it('renders footer note about contract terms', () => {
    render(<PricingTable />);
    expect(screen.getByText(/Programas con contrato mensual/)).toBeInTheDocument();
  });

  it('fetches paginated API response across multiple pages', async () => {
    mockedApi.get.mockReset();
    mockedApi.get
      .mockResolvedValueOnce({
        data: {
          results: [FAKE_PACKAGES[0], FAKE_PACKAGES[1]],
          next: 'http://api/packages/?page=2',
        },
      })
      .mockResolvedValueOnce({
        data: {
          results: [FAKE_PACKAGES[2]],
          next: null,
        },
      });

    render(<PricingTable />);

    await waitFor(() => {
      expect(screen.getByText('Sesión Individual')).toBeInTheDocument();
      expect(screen.getByText('Programa Integral')).toBeInTheDocument();
    });

    expect(mockedApi.get).toHaveBeenCalledTimes(2);
    expect(mockedApi.get).toHaveBeenCalledWith('/packages/');
    expect(mockedApi.get).toHaveBeenCalledWith('/packages/?page=2');
  });

  it('handles packages with sessions_count of zero', async () => {
    mockedApi.get.mockReset();
    const zeroPkg = { ...FAKE_PACKAGES[0], sessions_count: 0, price: '50000.00' };
    mockedApi.get.mockResolvedValue({ data: [zeroPkg] });

    render(<PricingTable />);
    await waitFor(() => {
      expect(screen.getByText('Sesión Individual')).toBeInTheDocument();
    });
  });

  it('handles paginated response with undefined results', async () => {
    mockedApi.get.mockReset();
    mockedApi.get.mockResolvedValueOnce({
      data: { results: undefined, next: null },
    });

    render(<PricingTable />);
    await waitFor(() => {
      expect(screen.getByText('Invierte en tu salud')).toBeInTheDocument();
    });
  });

  it('stops fetching when API call throws an error', async () => {
    mockedApi.get.mockReset();
    mockedApi.get.mockRejectedValue(new Error('Network'));

    render(<PricingTable />);

    await waitFor(() => {
      expect(screen.getByText('Invierte en tu salud')).toBeInTheDocument();
    });

    expect(mockedApi.get).toHaveBeenCalledTimes(1);
  });

  it('aborts state update when component unmounts before fetch resolves', async () => {
    mockedApi.get.mockReset();
    let resolveFetch: (value: { data: typeof FAKE_PACKAGES }) => void = () => {};
    mockedApi.get.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveFetch = resolve;
      }),
    );

    const { unmount } = render(<PricingTable />);
    unmount();
    resolveFetch({ data: FAKE_PACKAGES });

    await new Promise((r) => setTimeout(r, 0));
    expect(screen.queryByText('Sesión Individual')).not.toBeInTheDocument();
  });

  it('aborts post-loop state update when component unmounts between error and commit', async () => {
    mockedApi.get.mockReset();
    let rejectFetch: (reason?: unknown) => void = () => {};
    mockedApi.get.mockReturnValueOnce(
      new Promise((_resolve, reject) => {
        rejectFetch = reject;
      }),
    );

    const { unmount } = render(<PricingTable />);
    unmount();
    rejectFetch(new Error('Network'));

    await new Promise((r) => setTimeout(r, 0));
    expect(screen.queryByText('Sesión Individual')).not.toBeInTheDocument();
  });

  it('renders mobile program cards when some program categories have no packages', async () => {
    mockedApi.get.mockReset();
    mockedApi.get.mockResolvedValue({
      data: FAKE_PACKAGES.filter((p) => p.category === 'terapeutico'),
    });

    render(<PricingTable />);

    await waitFor(() => expect(mockedApi.get).toHaveBeenCalled());
    const programLinks = screen.getAllByRole('link').filter((a) => a.getAttribute('href')?.startsWith('/programs?program='));
    expect(programLinks.length).toBe(3);
  });
});
