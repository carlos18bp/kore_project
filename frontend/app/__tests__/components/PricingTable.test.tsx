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
    expect(screen.getByRole('button', { name: 'Semi-personalizado' })).toBeInTheDocument();
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

  it('switches to Semi-personalizado plans when tab is clicked', async () => {
    render(<PricingTable />);
    const user = userEvent.setup();

    await waitFor(() => expect(screen.getByText('Sesión Individual')).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: 'Semi-personalizado' }));

    expect(screen.getByText('Semi-personalizado FLW')).toBeInTheDocument();
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
});
