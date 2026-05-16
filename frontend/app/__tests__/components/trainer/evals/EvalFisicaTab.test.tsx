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

  it('shows the loading spinner when loading is true', () => {
    setupStore({ evaluations: [], loading: true });

    render(<EvalFisicaTab clientId={CLIENT_ID} />);

    // EvalSpinner shows; the empty state message must not render
    expect(screen.queryByText('Sin evaluaciones físicas. Registra la primera.')).not.toBeInTheDocument();
  });

  it('enters create mode when Nueva is clicked from the results view', () => {
    setupStore({ evaluations: [makeEval()] });

    render(<EvalFisicaTab clientId={CLIENT_ID} />);
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: '+ Nueva' }));
    });

    expect(screen.getByRole('button', { name: 'Crear evaluación' })).toBeInTheDocument();
  });

  it('calls createEvaluation and returns to results after saving a new evaluation', async () => {
    const { createEvaluation } = setupStore({ evaluations: [makeEval()] });

    render(<EvalFisicaTab clientId={CLIENT_ID} />);
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: '+ Nueva' }));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Crear evaluación' }));
    });

    expect(createEvaluation).toHaveBeenCalledWith(CLIENT_ID, expect.objectContaining({ evaluation_date: expect.any(String) }));
    expect(screen.getByText('Última evaluación')).toBeInTheDocument();
  });

  it('returns to results view when Cancelar is clicked during edit', () => {
    setupStore({ evaluations: [makeEval()] });

    render(<EvalFisicaTab clientId={CLIENT_ID} />);
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Editar esta evaluación' }));
    });
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    });

    expect(screen.getByText('Última evaluación')).toBeInTheDocument();
  });

  it('shows Sin medicion registrada in a TestCard when squats_reps is null', () => {
    setupStore({ evaluations: [makeEval({ squats_reps: null, squats_score: null })] });

    render(<EvalFisicaTab clientId={CLIENT_ID} />);

    expect(screen.getByText('Sin medición registrada')).toBeInTheDocument();
  });

  it('shows pain flag when squats_pain is true', () => {
    setupStore({ evaluations: [makeEval({ squats_pain: true })] });

    render(<EvalFisicaTab clientId={CLIENT_ID} />);

    expect(screen.getByText('⚠ Dolor')).toBeInTheDocument();
  });

  // ── New tests targeting uncovered branches ──────────────────

  it('renders all 5 test capacity cards in results view', () => {
    setupStore({ evaluations: [makeEval()] });

    render(<EvalFisicaTab clientId={CLIENT_ID} />);

    expect(screen.getAllByText('Sentadillas').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Flexiones').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Plancha').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Caminata 6 min').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Equilibrio unipodal').length).toBeGreaterThan(0);
  });

  it('renders the interrupted flag on a test card when squats_interrupted is true', () => {
    setupStore({ evaluations: [makeEval({ squats_interrupted: true })] });

    render(<EvalFisicaTab clientId={CLIENT_ID} />);

    expect(screen.getByText('◔ Interrumpida')).toBeInTheDocument();
  });

  it('renders the Borg effort perception label for the walk test', () => {
    setupStore({ evaluations: [makeEval({ walk_effort_perception: 7, walk_heart_rate: 140 })] });

    render(<EvalFisicaTab clientId={CLIENT_ID} />);

    // The TestCard renders "Borg 7 · esfuerzo"
    expect(screen.getByText(/Borg 7/)).toBeInTheDocument();
  });

  it('renders the Mobility section with joint labels', () => {
    setupStore({ evaluations: [makeEval({ hip_mobility: 4, shoulder_mobility: 3, ankle_mobility: 4 })] });

    render(<EvalFisicaTab clientId={CLIENT_ID} />);

    expect(screen.getByText('Movilidad articular')).toBeInTheDocument();
    // MobilitySection renders individual joint labels
    expect(screen.getByText('Cadera')).toBeInTheDocument();
    expect(screen.getByText('Hombros')).toBeInTheDocument();
    expect(screen.getByText('Tobillo')).toBeInTheDocument();
  });

  it('renders sub-index cells (Fuerza, Resistencia) in the dark hero section', () => {
    setupStore({ evaluations: [makeEval()] });

    render(<EvalFisicaTab clientId={CLIENT_ID} />);

    // ResultsHero renders subAxes: Fuerza, Resistencia, Movilidad, Balance
    expect(screen.getAllByText('Fuerza').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Resistencia').length).toBeGreaterThan(0);
  });

  it('renders a delta pill on the general index when a first evaluation exists', () => {
    const first = makeEval({ id: 0, evaluation_date: '2026-01-12', squats_reps: 15, general_index: '2.5' });
    setupStore({ evaluations: [makeEval(), first] });

    render(<EvalFisicaTab clientId={CLIENT_ID} />);

    // Delta pill appears in the dark hero card
    expect(screen.getAllByText(/↑|↓/).length).toBeGreaterThan(0);
  });

  it('renders pushups pain flag when pushups_pain is true', () => {
    setupStore({ evaluations: [makeEval({ pushups_pain: true })] });

    render(<EvalFisicaTab clientId={CLIENT_ID} />);

    expect(screen.getByText('⚠ Dolor')).toBeInTheDocument();
  });

  it('displays the error message when the store error field is non-empty', () => {
    mStore.mockReturnValue({
      evaluations: [makeEval()],
      loading: false,
      submitting: false,
      error: 'Error al guardar la evaluación física',
      fetchEvaluations: jest.fn(),
      createEvaluation: jest.fn(),
      updateEvaluation: jest.fn(),
    });

    render(<EvalFisicaTab clientId={CLIENT_ID} />);
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Editar esta evaluación' }));
    });

    expect(screen.getByText('Error al guardar la evaluación física')).toBeInTheDocument();
  });
});
