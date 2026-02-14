import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ProgramasPage from '@/app/(public)/programas/page';

jest.mock('next/image', () => ({
  __esModule: true,
  default: (props: React.ImgHTMLAttributes<HTMLImageElement>) => <img {...props} />,
}));

describe('ProgramasPage', () => {
  beforeEach(() => {
    render(<ProgramasPage />);
  });

  it('renders the tariff badge', () => {
    expect(screen.getByText('Tarifas 2026')).toBeInTheDocument();
  });

  it('shows Personalizado program by default', () => {
    expect(screen.getByText('Personalizado FLW')).toBeInTheDocument();
    expect(screen.getByText('Tu proceso, tu ritmo')).toBeInTheDocument();
  });

  it('renders all plan options for the default program', () => {
    expect(screen.getByText('Sesión Individual')).toBeInTheDocument();
    expect(screen.getByText('Programa Básico')).toBeInTheDocument();
    expect(screen.getByText('Programa Integral')).toBeInTheDocument();
  });

  it('switches to Semi-personalizado when tab is clicked', async () => {
    const user = userEvent.setup();
    const semiButton = screen.getAllByText('Semi-personalizado')[0];
    await user.click(semiButton.closest('button')!);

    expect(screen.getByText('Semi-personalizado FLW')).toBeInTheDocument();
    expect(screen.getByText('Comparte el camino')).toBeInTheDocument();
    expect(screen.getByText('Programa Inicial')).toBeInTheDocument();
  });

  it('switches to Terapéutico when tab is clicked', async () => {
    const user = userEvent.setup();
    const terapeuticoButton = screen.getAllByText('Terapéutico')[0];
    await user.click(terapeuticoButton.closest('button')!);

    expect(screen.getByText('Terapéutico FLW')).toBeInTheDocument();
    expect(screen.getByText('Movimiento como medicina')).toBeInTheDocument();
  });

  it('shows CTA when a plan is selected', async () => {
    const user = userEvent.setup();
    const planButton = screen.getByText('Sesión Individual').closest('button')!;
    await user.click(planButton);

    expect(screen.getByText(/Reservar Sesión Individual/)).toBeInTheDocument();
  });

  it('resets plan selection when switching programs', async () => {
    const user = userEvent.setup();

    // Select a plan in Personalizado
    await user.click(screen.getByText('Sesión Individual').closest('button')!);
    expect(screen.getByText(/Reservar Sesión Individual/)).toBeInTheDocument();

    // Switch to Semi-personalizado
    await user.click(screen.getByText('Semi-personalizado'));

    // CTA should no longer show the Personalizado plan
    expect(screen.queryByText(/Reservar Sesión Individual/)).not.toBeInTheDocument();
  });

  it('formats prices correctly in Colombian format', () => {
    // $85.000 from Sesión Individual (85000)
    expect(screen.getByText('$85.000')).toBeInTheDocument();
  });

  it('shows session pluralization correctly', () => {
    expect(screen.getByText(/1 sesión/)).toBeInTheDocument();
    expect(screen.getAllByText(/sesiones/).length).toBeGreaterThan(0);
  });
});
