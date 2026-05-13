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
});
