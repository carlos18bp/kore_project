import { render, screen, act, fireEvent } from '@testing-library/react';
import EvalPosturTab from '@/app/components/trainer/evals/EvalPosturTab';
import { usePosturometryStore } from '@/lib/stores/posturometryStore';

jest.mock('@/lib/stores/posturometryStore', () => ({ usePosturometryStore: jest.fn() }));

const mStore = usePosturometryStore as unknown as jest.Mock;
const CLIENT_ID = 5;

function makeEval(overrides: Record<string, unknown> = {}) {
  return {
    id: 1, customer_id: CLIENT_ID, trainer_name: 'Ana', evaluation_date: '2026-03-14',
    anterior_data: {}, lateral_right_data: {}, lateral_left_data: {}, posterior_data: {},
    anterior_photo: null, lateral_right_photo: null, lateral_left_photo: null, posterior_photo: null,
    anterior_observations: '', lateral_right_observations: '', lateral_left_observations: '', posterior_observations: '',
    notes: 'Postura funcional', recommendations: {},
    global_index: '85', global_category: 'Bueno', global_color: 'green',
    upper_index: '80', upper_category: 'Bueno', upper_color: 'green',
    central_index: '88', central_category: 'Muy bueno', central_color: 'green',
    lower_index: '82', lower_category: 'Bueno', lower_color: 'green',
    segment_scores: {}, findings: {}, created_at: '2026-03-14T10:00:00Z',
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

describe('EvalPosturTab', () => {
  beforeEach(() => jest.clearAllMocks());

  it('shows the empty state when there are no evaluations', () => {
    setupStore({ evaluations: [] });

    render(<EvalPosturTab clientId={CLIENT_ID} />);

    expect(screen.getByText('Sin evaluaciones posturales. Registra la primera.')).toBeInTheDocument();
  });

  it('renders the region section from the latest evaluation', () => {
    setupStore({ evaluations: [makeEval()] });

    render(<EvalPosturTab clientId={CLIENT_ID} />);

    expect(screen.getByText('Por región')).toBeInTheDocument();
    expect(screen.getByText('Hallazgos por vista')).toBeInTheDocument();
  });

  it('shows the auto-calculated index cards in the form view', () => {
    setupStore({ evaluations: [makeEval()] });

    render(<EvalPosturTab clientId={CLIENT_ID} />);
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Formulario' }));
    });

    expect(screen.getByText('Resultados auto-calculados')).toBeInTheDocument();
    expect(screen.getByText('Índice global')).toBeInTheDocument();
  });

  it('renders a delta pill when a previous evaluation exists', () => {
    const prev = makeEval({ id: 0, evaluation_date: '2026-01-14', global_index: '70', upper_index: '65', central_index: '72', lower_index: '68' });
    setupStore({ evaluations: [makeEval(), prev] });

    render(<EvalPosturTab clientId={CLIENT_ID} />);

    expect(screen.getAllByText(/↑|↓/).length).toBeGreaterThan(0);
  });

  it('updates the evaluation-date field when edited', () => {
    setupStore({ evaluations: [makeEval()] });

    render(<EvalPosturTab clientId={CLIENT_ID} />);
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Editar esta evaluación' }));
    });
    const dateInput = screen.getByDisplayValue('2026-03-14');
    act(() => {
      fireEvent.change(dateInput, { target: { value: '2026-04-04' } });
    });

    expect(screen.getByDisplayValue('2026-04-04')).toBeInTheDocument();
  });

  it('calls fullUpdateEvaluation and returns to the results view when an edit is saved', async () => {
    const { fullUpdateEvaluation } = setupStore({ evaluations: [makeEval()] });

    render(<EvalPosturTab clientId={CLIENT_ID} />);
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Editar esta evaluación' }));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Actualizar evaluación' }));
    });

    expect(fullUpdateEvaluation).toHaveBeenCalledWith(CLIENT_ID, 1, expect.objectContaining({ evaluation_date: '2026-03-14' }));
    expect(screen.getByText('Última evaluación')).toBeInTheDocument();
  });

  // ── New tests targeting uncovered branches ──────────────────

  it('renders view tab switcher in edit mode (Anterior, Lateral derecha)', () => {
    setupStore({ evaluations: [makeEval()] });

    render(<EvalPosturTab clientId={CLIENT_ID} />);
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Editar esta evaluación' }));
    });

    // FORM_VIEWS tabs: Anterior, Lateral derecha, Lateral izquierda, Posterior
    expect(screen.getByRole('button', { name: 'Anterior' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Lateral derecha' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Posterior' })).toBeInTheDocument();
  });

  it('clicking a view tab changes the active view (lateral izquierda segments render)', () => {
    setupStore({ evaluations: [makeEval()] });

    render(<EvalPosturTab clientId={CLIENT_ID} />);
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Editar esta evaluación' }));
    });
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Lateral izquierda' }));
    });

    // After switching to lateral_left, multiple elements reference "lateral izquierda"
    expect(screen.getAllByText(/lateral izquierda/i).length).toBeGreaterThan(0);
  });

  it('renders Funcional band label when global_index is 0.3 (≤ 0.5)', () => {
    setupStore({ evaluations: [makeEval({ global_index: '0.3', upper_index: '0.3', central_index: '0.3', lower_index: '0.3' })] });

    render(<EvalPosturTab clientId={CLIENT_ID} />);

    expect(screen.getAllByText('Funcional').length).toBeGreaterThan(0);
  });

  it('renders Moderado band label when global_index is 1.5 (> 1.2 and ≤ 2.0)', () => {
    setupStore({ evaluations: [makeEval({ global_index: '1.5', upper_index: '1.5', central_index: '1.5', lower_index: '1.5' })] });

    render(<EvalPosturTab clientId={CLIENT_ID} />);

    expect(screen.getAllByText('Moderado').length).toBeGreaterThan(0);
  });

  it('renders Importante band label when global_index is 2.2 (> 2.0)', () => {
    setupStore({ evaluations: [makeEval({ global_index: '2.2', upper_index: '2.2', central_index: '2.2', lower_index: '2.2' })] });

    render(<EvalPosturTab clientId={CLIENT_ID} />);

    expect(screen.getAllByText('Importante').length).toBeGreaterThan(0);
  });

  it('renders a delta pill on the hero when two evaluations exist', () => {
    const prev = makeEval({ id: 0, evaluation_date: '2026-01-14', global_index: '1.8', upper_index: '1.8', central_index: '1.8', lower_index: '1.8' });
    setupStore({ evaluations: [makeEval({ global_index: '0.8', upper_index: '0.8', central_index: '0.8', lower_index: '0.8' }), prev] });

    render(<EvalPosturTab clientId={CLIENT_ID} />);

    expect(screen.getAllByText(/↑|↓/).length).toBeGreaterThan(0);
  });

  it('renders the photo slot (Foto vista) area in edit mode', () => {
    setupStore({ evaluations: [makeEval()] });

    render(<EvalPosturTab clientId={CLIENT_ID} />);
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Editar esta evaluación' }));
    });

    // PhotoSlot renders with label text matching the view
    expect(screen.getByText(/foto vista anterior/i)).toBeInTheDocument();
  });

  it('shows the notes textarea in edit mode', () => {
    setupStore({ evaluations: [makeEval({ notes: 'Corrección postural necesaria' })] });

    render(<EvalPosturTab clientId={CLIENT_ID} />);
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Editar esta evaluación' }));
    });

    // NotesField renders a textarea pre-filled with existing notes
    expect(screen.getByDisplayValue('Corrección postural necesaria')).toBeInTheDocument();
  });

  it('renders the region card with importance text for the global region', () => {
    setupStore({ evaluations: [makeEval({ global_index: '0.3', upper_index: '0.3', central_index: '0.3', lower_index: '0.3', global_color: 'green' })] });

    render(<EvalPosturTab clientId={CLIENT_ID} />);

    // RegionCard renders "Por qué importa" section (appears once per region card)
    expect(screen.getAllByText('Por qué importa').length).toBeGreaterThan(0);
    // The global region's importance text for 'green' color
    expect(screen.getByText('Postura funcional, base de movimiento eficiente.')).toBeInTheDocument();
  });

  it('displays the error message when the store error field is non-empty', () => {
    mStore.mockReturnValue({
      evaluations: [makeEval()],
      loading: false,
      submitting: false,
      error: 'Error al guardar la posturometría',
      fetchEvaluations: jest.fn(),
      createEvaluation: jest.fn(),
      fullUpdateEvaluation: jest.fn(),
    });

    render(<EvalPosturTab clientId={CLIENT_ID} />);
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Editar esta evaluación' }));
    });

    expect(screen.getByText('Error al guardar la posturometría')).toBeInTheDocument();
  });
});
