import { render, screen, act, fireEvent } from '@testing-library/react';
import EvalAntropTab from '@/app/components/trainer/evals/EvalAntropTab';
import { useAnthropometryStore } from '@/lib/stores/anthropometryStore';

jest.mock('@/lib/stores/anthropometryStore', () => ({ useAnthropometryStore: jest.fn() }));

const mStore = useAnthropometryStore as unknown as jest.Mock;
const CLIENT_ID = 3;

function makeEval(overrides: Record<string, unknown> = {}) {
  return {
    id: 1, customer_id: CLIENT_ID, trainer_name: 'Ana', evaluation_date: '2026-03-10',
    weight_kg: '80.0', height_cm: '178', waist_cm: '85', hip_cm: '98',
    perimeters: {}, skinfolds: {}, notes: 'Buen progreso', recommendations: {},
    age_at_evaluation: 30,
    bmi: '25.2', bmi_category: 'Sobrepeso', bmi_color: 'amber',
    waist_hip_ratio: null, whr_risk: '', whr_color: 'green',
    waist_height_ratio: null, whe_risk: '', whe_color: 'green',
    body_fat_pct: '20.0', bf_category: 'Normal', bf_color: 'green', bf_method: 'Pliegues',
    fat_mass_kg: '16.0', lean_mass_kg: '64.0',
    waist_risk: '', waist_risk_color: 'green', sum_skinfolds: null,
    asymmetries: {}, created_at: '2026-03-10T10:00:00Z',
    ...overrides,
  };
}

function setupStore(opts: { evaluations?: unknown[]; loading?: boolean; create?: jest.Mock; update?: jest.Mock } = {}) {
  const createEvaluation = opts.create ?? jest.fn().mockResolvedValue(makeEval());
  const fullUpdateEvaluation = opts.update ?? jest.fn().mockResolvedValue(makeEval());
  mStore.mockReturnValue({
    evaluations: opts.evaluations ?? [],
    loading: opts.loading ?? false,
    submitting: false,
    error: '',
    fetchEvaluations: jest.fn(),
    createEvaluation,
    fullUpdateEvaluation,
  });
  return { createEvaluation, fullUpdateEvaluation };
}

describe('EvalAntropTab', () => {
  beforeEach(() => jest.clearAllMocks());

  it('shows the empty state when there are no evaluations', () => {
    setupStore({ evaluations: [] });

    render(<EvalAntropTab clientId={CLIENT_ID} />);

    expect(screen.getByText('Sin evaluaciones antropométricas. Registra la primera.')).toBeInTheDocument();
  });

  it('renders the IMC metric label from the latest evaluation', () => {
    setupStore({ evaluations: [makeEval()] });

    render(<EvalAntropTab clientId={CLIENT_ID} />);

    expect(screen.getAllByText('IMC').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Sobrepeso').length).toBeGreaterThan(0);
  });

  it('shows the auto-calculated computed cards in the form view', () => {
    setupStore({ evaluations: [makeEval()] });

    render(<EvalAntropTab clientId={CLIENT_ID} />);
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Formulario' }));
    });

    expect(screen.getByText('Resultados auto-calculados')).toBeInTheDocument();
    expect(screen.getByText('Masa magra')).toBeInTheDocument();
  });

  it('renders a delta pill when a previous evaluation exists', () => {
    const prev = makeEval({ id: 0, evaluation_date: '2026-01-10', bmi: '27.0', body_fat_pct: '23.0', lean_mass_kg: '60.0', fat_mass_kg: '20.0' });
    setupStore({ evaluations: [makeEval(), prev] });

    render(<EvalAntropTab clientId={CLIENT_ID} />);

    expect(screen.getAllByText(/↓|↑/).length).toBeGreaterThan(0);
  });

  it('updates the evaluation-date field when edited', () => {
    setupStore({ evaluations: [makeEval()] });

    render(<EvalAntropTab clientId={CLIENT_ID} />);
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Editar esta evaluación' }));
    });
    const dateInput = screen.getByDisplayValue('2026-03-10');
    act(() => {
      fireEvent.change(dateInput, { target: { value: '2026-04-01' } });
    });

    expect(screen.getByDisplayValue('2026-04-01')).toBeInTheDocument();
  });

  it('calls fullUpdateEvaluation and returns to the results view when an edit is saved', async () => {
    const { fullUpdateEvaluation } = setupStore({ evaluations: [makeEval()] });

    render(<EvalAntropTab clientId={CLIENT_ID} />);
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Editar esta evaluación' }));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Actualizar evaluación' }));
    });

    expect(fullUpdateEvaluation).toHaveBeenCalledWith(CLIENT_ID, 1, expect.objectContaining({ evaluation_date: '2026-03-10' }));
    expect(screen.getByText('Última evaluación')).toBeInTheDocument();
  });
});
