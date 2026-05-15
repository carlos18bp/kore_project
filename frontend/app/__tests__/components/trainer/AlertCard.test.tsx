import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AlertCard from '@/app/components/trainer/AlertCard';
import type { ClientRiskScore, RiskSignal } from '@/lib/stores/trainerStore';

// ── Mocks ────────────────────────────────────────────────────────────────────

jest.mock('next/link', () => {
  const MockLink = ({ href, children, ...props }: { href: string; children: React.ReactNode; [key: string]: unknown }) => (
    <a href={href} {...props}>{children}</a>
  );
  MockLink.displayName = 'MockLink';
  return MockLink;
});

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeSignal(overrides: Partial<RiskSignal> = {}): RiskSignal {
  return {
    type: 'low_adherence',
    label: 'Adherencia baja al entrenamiento',
    severity: 'alto',
    detail: 'El cliente no ha completado más del 50% de los entrenamientos.',
    since_date: '2026-04-01',
    module: 'physical',
    ...overrides,
  };
}

function makeAlert(overrides: Partial<ClientRiskScore> = {}): ClientRiskScore {
  return {
    id: 7,
    customer_id: 99,
    customer_name: 'María Rodríguez',
    avatar_url: null,
    level: 'alto',
    computed_at: '2026-05-01T10:00:00Z',
    kore_score: 65,
    signals_count: 2,
    behavioral_signals: [makeSignal({ label: 'Señal conductual', module: 'physical' })],
    clinical_signals: [makeSignal({ severity: 'medio', label: 'Señal clínica', module: 'anthropometry' })],
    resolutions: [],
    ...overrides,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

afterEach(() => {
  jest.clearAllMocks();
});

describe('AlertCard', () => {
  it('renders the customer name', () => {
    render(<AlertCard alert={makeAlert()} onResolve={jest.fn()} />);
    expect(screen.getByText('María Rodríguez')).toBeInTheDocument();
  });

  it('renders "Alto riesgo" badge for level alto', () => {
    render(<AlertCard alert={makeAlert({ level: 'alto' })} onResolve={jest.fn()} />);
    expect(screen.getByText('Alto riesgo')).toBeInTheDocument();
  });

  it('renders "Riesgo medio" badge for level medio', () => {
    render(<AlertCard alert={makeAlert({ level: 'medio' })} onResolve={jest.fn()} />);
    expect(screen.getByText('Riesgo medio')).toBeInTheDocument();
  });

  it('renders "Riesgo bajo" badge for level bajo', () => {
    render(<AlertCard alert={makeAlert({ level: 'bajo' })} onResolve={jest.fn()} />);
    expect(screen.getByText('Riesgo bajo')).toBeInTheDocument();
  });

  it('renders "Sin riesgo" badge for level sin_riesgo', () => {
    render(<AlertCard alert={makeAlert({ level: 'sin_riesgo' })} onResolve={jest.fn()} />);
    expect(screen.getByText('Sin riesgo')).toBeInTheDocument();
  });

  it('applies the alto border color class for level alto', () => {
    const { container } = render(<AlertCard alert={makeAlert({ level: 'alto' })} onResolve={jest.fn()} />);
    const card = container.firstChild as HTMLElement;
    expect(card.className).toContain('border-l-kore-red');
  });

  it('applies the medio border color class for level medio', () => {
    const { container } = render(<AlertCard alert={makeAlert({ level: 'medio' })} onResolve={jest.fn()} />);
    const card = container.firstChild as HTMLElement;
    expect(card.className).toContain('border-l-amber-400');
  });

  it('renders signal labels when signals are present', () => {
    render(<AlertCard alert={makeAlert()} onResolve={jest.fn()} />);
    expect(screen.getByText('Señal conductual')).toBeInTheDocument();
    expect(screen.getByText('Señal clínica')).toBeInTheDocument();
  });

  it('renders the correct signal count text', () => {
    render(<AlertCard alert={makeAlert()} onResolve={jest.fn()} />);
    expect(screen.getByText('2 señales')).toBeInTheDocument();
  });

  it('renders "1 señal" in singular when only one signal exists', () => {
    const alert = makeAlert({ behavioral_signals: [makeSignal()], clinical_signals: [] });
    render(<AlertCard alert={alert} onResolve={jest.fn()} />);
    expect(screen.getByText('1 señal')).toBeInTheDocument();
  });

  it('hides the signal section when both signal arrays are empty', () => {
    const alert = makeAlert({ behavioral_signals: [], clinical_signals: [] });
    render(<AlertCard alert={alert} onResolve={jest.fn()} />);
    expect(screen.queryByText('Señal conductual')).not.toBeInTheDocument();
  });

  it('clicking a signal button toggles the expanded detail', async () => {
    const user = userEvent.setup();
    render(<AlertCard alert={makeAlert()} onResolve={jest.fn()} />);

    // Detail is hidden initially
    expect(screen.queryByText('El cliente no ha completado más del 50% de los entrenamientos.')).not.toBeInTheDocument();

    // Expand
    await user.click(screen.getByRole('button', { name: /Señal conductual/ }));
    expect(screen.getByText('El cliente no ha completado más del 50% de los entrenamientos.')).toBeInTheDocument();

    // Collapse
    await user.click(screen.getByRole('button', { name: /Señal conductual/ }));
    expect(screen.queryByText('El cliente no ha completado más del 50% de los entrenamientos.')).not.toBeInTheDocument();
  });

  it('calls onResolve with the alert id when "Resolver alerta" is clicked', async () => {
    const user = userEvent.setup();
    const onResolve = jest.fn();
    render(<AlertCard alert={makeAlert({ id: 7 })} onResolve={onResolve} />);

    await user.click(screen.getByRole('button', { name: 'Resolver alerta' }));
    expect(onResolve).toHaveBeenCalledTimes(1);
    expect(onResolve).toHaveBeenCalledWith(7);
  });

  it('renders the "Resolver alerta" button', () => {
    render(<AlertCard alert={makeAlert()} onResolve={jest.fn()} />);
    expect(screen.getByRole('button', { name: 'Resolver alerta' })).toBeInTheDocument();
  });

  it('renders customer initials derived from customer_name', () => {
    render(<AlertCard alert={makeAlert({ customer_name: 'María Rodríguez' })} onResolve={jest.fn()} />);
    expect(screen.getByText('MR')).toBeInTheDocument();
  });

  it('renders an eval link when signals have a known module', () => {
    render(<AlertCard alert={makeAlert()} onResolve={jest.fn()} />);
    // Should have a link to create an evaluation
    const links = screen.getAllByRole('link');
    expect(links.length).toBeGreaterThan(0);
  });
});
