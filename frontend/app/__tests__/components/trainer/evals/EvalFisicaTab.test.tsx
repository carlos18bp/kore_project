import { render, screen, act, fireEvent } from '@testing-library/react';
import EvalFisicaTab from '@/app/components/trainer/evals/EvalFisicaTab';
import { usePhysicalEvaluationStore } from '@/lib/stores/physicalEvaluationStore';

jest.mock('@/lib/stores/physicalEvaluationStore', () => ({ usePhysicalEvaluationStore: jest.fn() }));

const mStore = usePhysicalEvaluationStore as unknown as jest.Mock;
const CLIENT_ID = 4;

function makeEval(overrides: Record<string, unknown> = {}) {
  return {
    id: 1, customer_id: CLIENT_ID, trainer_name: 'Ana', evaluation_date: '2026-03-12',
    age_at_evaluation: 30, sex_at_evaluation: 'M',
    squats_reps: 30, pushups_reps: 20, plank_seconds: 90, walk_meters: 600, unipodal_seconds: 40,
    hip_mobility: 4, shoulder_mobility: 3, ankle_mobility: 4,
    squats_notes: '', squats_pain: false, squats_interrupted: false,
    pushups_notes: '', pushups_pain: false, plank_notes: '', plank_pain: false,
    walk_notes: '', walk_effort_perception: 6, walk_heart_rate: 130,
    unipodal_notes: '', mobility_notes: '', notes: 'Buen nivel base', recommendations: {},
    squats_score: 4, pushups_score: 3, plank_score: 4, walk_score: 3, unipodal_score: 4,
    strength_index: '3.5', strength_category: 'Bueno', strength_color: 'green',
    endurance_index: '3.0', endurance_category: 'Intermedio', endurance_color: 'amber',
    mobility_index: '3.7', mobility_category: 'Bueno', mobility_color: 'green',
    balance_index: '4.0', balance_category: 'Muy bueno', balance_color: 'green',
    general_index: '3.5', general_category: 'Bueno', general_color: 'green',
    cross_module_alerts: {}, created_at: '2026-03-12T10:00:00Z',
    ...overrides,
  };
}

function setupStore(opts: { evaluations?: unknown[]; loading?: boolean; create?: jest.Mock; update?: jest.Mock } = {}) {
  const createEvaluation = opts.create ?? jest.fn().mockResolvedValue(makeEval());
  const updateEvaluation = opts.update ?? jest.fn().mockResolvedValue(makeEval());
  mStore.mockReturnValue({
    evaluations: opts.evaluations ?? [],
    loading: opts.loading ?? false,
    submitting: false,
    error: '',
    fetchEvaluations: jest.fn(),
    createEvaluation,
    updateEvaluation,
  });
  return { createEvaluation, updateEvaluation };
}

describe('EvalFisicaTab', () => {
  beforeEach(() => jest.clearAllMocks());

  it('shows the empty state when there are no evaluations', () => {
    setupStore({ evaluations: [] });

    render(<EvalFisicaTab clientId={CLIENT_ID} />);

    expect(screen.getByText('Sin evaluaciones físicas. Registra la primera.')).toBeInTheDocument();
  });

  it('renders the test capacity cards from the latest evaluation', () => {
    setupStore({ evaluations: [makeEval()] });

    render(<EvalFisicaTab clientId={CLIENT_ID} />);

    expect(screen.getAllByText('Sentadillas').length).toBeGreaterThan(0);
    expect(screen.getByText('Por capacidad')).toBeInTheDocument();
  });

  it('shows the auto-calculated index cards in the form view', () => {
    setupStore({ evaluations: [makeEval()] });

    render(<EvalFisicaTab clientId={CLIENT_ID} />);
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Formulario' }));
    });

    expect(screen.getByText('Resultados auto-calculados')).toBeInTheDocument();
    expect(screen.getByText('Resistencia')).toBeInTheDocument();
  });

  it('renders a delta pill when a previous evaluation exists', () => {
    const prev = makeEval({ id: 0, evaluation_date: '2026-01-12', squats_reps: 20, general_index: '2.8' });
    setupStore({ evaluations: [makeEval(), prev] });

    render(<EvalFisicaTab clientId={CLIENT_ID} />);

    expect(screen.getAllByText(/↑|↓/).length).toBeGreaterThan(0);
  });

  it('updates the evaluation-date field when edited', () => {
    setupStore({ evaluations: [makeEval()] });

    render(<EvalFisicaTab clientId={CLIENT_ID} />);
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Editar esta evaluación' }));
    });
    const dateInput = screen.getByDisplayValue('2026-03-12');
    act(() => {
      fireEvent.change(dateInput, { target: { value: '2026-04-02' } });
    });

    expect(screen.getByDisplayValue('2026-04-02')).toBeInTheDocument();
  });

  it('calls updateEvaluation and returns to the results view when an edit is saved', async () => {
    const { updateEvaluation } = setupStore({ evaluations: [makeEval()] });

    render(<EvalFisicaTab clientId={CLIENT_ID} />);
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Editar esta evaluación' }));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Actualizar evaluación' }));
    });

    expect(updateEvaluation).toHaveBeenCalledWith(CLIENT_ID, 1, expect.objectContaining({ evaluation_date: '2026-03-12' }));
    expect(screen.getByText('Última evaluación')).toBeInTheDocument();
  });
});
