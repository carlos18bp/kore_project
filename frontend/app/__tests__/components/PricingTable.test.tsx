import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PricingTable from '@/app/components/PricingTable';

describe('PricingTable', () => {
  beforeEach(() => {
    render(<PricingTable />);
  });

  it('renders the section header', () => {
    expect(screen.getByText('Tarifas 2026')).toBeInTheDocument();
    expect(screen.getByText('Invierte en tu salud')).toBeInTheDocument();
  });

  it('renders the three program tab buttons', () => {
    expect(screen.getByRole('button', { name: 'Personalizado' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Semi-personalizado' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Terapéutico' })).toBeInTheDocument();
  });

  it('shows Personalizado plans by default', () => {
    expect(screen.getByText('Personalizado FLW')).toBeInTheDocument();
    expect(screen.getByText('Sesión Individual')).toBeInTheDocument();
    expect(screen.getByText('Programa Integral')).toBeInTheDocument();
  });

  it('switches to Semi-personalizado plans when tab is clicked', async () => {
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Semi-personalizado' }));

    expect(screen.getByText('Semi-personalizado FLW')).toBeInTheDocument();
    expect(screen.getByText('Programa Inicial')).toBeInTheDocument();
  });

  it('switches to Terapéutico plans when tab is clicked', async () => {
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Terapéutico' }));

    expect(screen.getByText('Terapéutico FLW')).toBeInTheDocument();
    expect(screen.getByText('Sesión Terapéutica')).toBeInTheDocument();
  });

  it('shows "Más elegido" badge on the middle plan', () => {
    expect(screen.getByText('Más elegido')).toBeInTheDocument();
  });

  it('shows correct pluralization for sessions (singular vs plural)', () => {
    // Personalizado has 1-session plan
    expect(screen.getByText('sesión')).toBeInTheDocument();
    expect(screen.getAllByText('sesiones').length).toBeGreaterThan(0);
  });

  it('renders footer note about contract terms', () => {
    expect(screen.getByText(/Programas con contrato mensual/)).toBeInTheDocument();
  });
});
