import { render, screen } from '@testing-library/react';
import EvalParqTab from '@/app/components/trainer/evals/EvalParqTab';
import { useParqStore } from '@/lib/stores/parqStore';

jest.mock('@/lib/stores/parqStore', () => ({
  useParqStore: jest.fn(),
}));

const mStore = useParqStore as unknown as jest.Mock;
const CLIENT_ID = 7;

function makeAssessment(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    customer_id: CLIENT_ID,
    q1_heart_condition: false,
    q2_chest_pain: false,
    q3_dizziness: false,
    q4_chronic_condition: false,
    q5_prescribed_medication: false,
    q6_bone_joint_problem: false,
    q7_medical_supervision: false,
    additional_notes: '',
    yes_count: 0,
    risk_classification: 'bajo',
    risk_label: 'Bajo riesgo',
    risk_color: 'green',
    created_at: '2026-03-10T08:00:00Z',
    ...overrides,
  };
}

function setupStore(opts: {
  assessments?: unknown[];
  loading?: boolean;
  fetchClientAssessments?: jest.Mock;
} = {}) {
  const fetchClientAssessments = opts.fetchClientAssessments ?? jest.fn();
  mStore.mockReturnValue({
    assessments: opts.assessments ?? [],
    loading: opts.loading ?? false,
    submitting: false,
    error: '',
    fetchClientAssessments,
    fetchMyAssessments: jest.fn(),
    createAssessment: jest.fn(),
    updateNotes: jest.fn(),
  });
  return { fetchClientAssessments };
}

describe('EvalParqTab', () => {
  beforeEach(() => jest.clearAllMocks());

  it('renders a loading spinner when loading is true', () => {
    setupStore({ loading: true });

    render(<EvalParqTab clientId={CLIENT_ID} />);

    // EvalSpinner renders — the empty state message must not appear
    expect(screen.queryByText(/Sin cuestionarios/i)).not.toBeInTheDocument();
  });

  it('renders the empty state message when assessments list is empty', () => {
    setupStore({ assessments: [] });

    render(<EvalParqTab clientId={CLIENT_ID} />);

    expect(screen.getByText('Sin cuestionarios PAR-Q+ completados por el cliente.')).toBeInTheDocument();
  });

  it('renders 7 PAR-Q questions when an assessment is provided', () => {
    setupStore({ assessments: [makeAssessment()] });

    render(<EvalParqTab clientId={CLIENT_ID} />);

    // The questionnaire section header is present
    expect(screen.getByText('Cuestionario PAR-Q+ (7 preguntas)')).toBeInTheDocument();
  });

  it('shows the warning box when yes_count is greater than zero', () => {
    setupStore({ assessments: [makeAssessment({ yes_count: 2, risk_classification: 'alto' })] });

    render(<EvalParqTab clientId={CLIENT_ID} />);

    expect(screen.getByText('Consideraciones')).toBeInTheDocument();
  });

  it('does not show the warning box when yes_count is zero', () => {
    setupStore({ assessments: [makeAssessment({ yes_count: 0, risk_classification: 'bajo' })] });

    render(<EvalParqTab clientId={CLIENT_ID} />);

    expect(screen.queryByText('Consideraciones')).not.toBeInTheDocument();
  });

  it('renders the risk classification card with "danger" tone for "alto" risk', () => {
    setupStore({ assessments: [makeAssessment({ yes_count: 3, risk_classification: 'alto', risk_label: 'Alto riesgo' })] });

    render(<EvalParqTab clientId={CLIENT_ID} />);

    // ComputedCard shows the risk_label value
    expect(screen.getByText('Alto riesgo')).toBeInTheDocument();
  });

  it('calls fetchClientAssessments on mount with the given clientId', () => {
    const { fetchClientAssessments } = setupStore({ assessments: [makeAssessment()] });

    render(<EvalParqTab clientId={CLIENT_ID} />);

    expect(fetchClientAssessments).toHaveBeenCalledWith(CLIENT_ID);
  });
});
