import { render, screen } from '@testing-library/react';
import EvalParqTab from '@/app/components/trainer/evals/EvalParqTab';
import { useParqStore, type ParqAssessment } from '@/lib/stores/parqStore';

jest.mock('@/lib/stores/parqStore', () => ({ useParqStore: jest.fn() }));

const mStore = useParqStore as unknown as jest.Mock;
const CLIENT_ID = 3;

function makeAssessment(over: Partial<ParqAssessment> = {}): ParqAssessment {
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
    risk_label: 'Riesgo bajo',
    risk_color: 'green',
    created_at: '2026-03-10T10:00:00Z',
    ...over,
  } as ParqAssessment;
}

function setup(over: { assessments?: ParqAssessment[]; loading?: boolean; fetch?: jest.Mock } = {}) {
  const fetchClientAssessments = over.fetch ?? jest.fn();
  mStore.mockReturnValue({
    assessments: over.assessments ?? [],
    loading: over.loading ?? false,
    fetchClientAssessments,
  });
  return { fetchClientAssessments };
}

describe('EvalParqTab', () => {
  beforeEach(() => jest.clearAllMocks());

  it('fetches the client assessments on mount', () => {
    const { fetchClientAssessments } = setup();
    render(<EvalParqTab clientId={CLIENT_ID} />);
    expect(fetchClientAssessments).toHaveBeenCalledWith(CLIENT_ID);
  });

  it('shows the empty-state message when the client has no assessments', () => {
    setup({ assessments: [] });
    render(<EvalParqTab clientId={CLIENT_ID} />);
    expect(screen.getByText('Sin cuestionarios PAR-Q+ completados por el cliente.')).toBeInTheDocument();
  });

  it('does not render the empty state while loading', () => {
    setup({ assessments: [], loading: true });
    render(<EvalParqTab clientId={CLIENT_ID} />);
    expect(screen.queryByText('Sin cuestionarios PAR-Q+ completados por el cliente.')).not.toBeInTheDocument();
  });

  it('renders the PAR-Q+ questionnaire heading for the latest assessment', () => {
    setup({ assessments: [makeAssessment()] });
    render(<EvalParqTab clientId={CLIENT_ID} />);
    expect(screen.getByText('Cuestionario PAR-Q+ (7 preguntas)')).toBeInTheDocument();
  });

  it('renders the risk classification label of the assessment', () => {
    setup({ assessments: [makeAssessment({ risk_label: 'Riesgo alto', risk_classification: 'alto' })] });
    render(<EvalParqTab clientId={CLIENT_ID} />);
    expect(screen.getByText('Riesgo alto')).toBeInTheDocument();
  });

  it('shows the considerations block when there is at least one affirmative answer', () => {
    setup({ assessments: [makeAssessment({ yes_count: 2, q1_heart_condition: true, q2_chest_pain: true })] });
    render(<EvalParqTab clientId={CLIENT_ID} />);
    expect(screen.getByText('Consideraciones')).toBeInTheDocument();
  });

  it('hides the considerations block when there are no affirmative answers', () => {
    setup({ assessments: [makeAssessment({ yes_count: 0 })] });
    render(<EvalParqTab clientId={CLIENT_ID} />);
    expect(screen.queryByText('Consideraciones')).not.toBeInTheDocument();
  });

  it('renders the client additional notes when present', () => {
    setup({ assessments: [makeAssessment({ additional_notes: 'Molestia lumbar leve' })] });
    render(<EvalParqTab clientId={CLIENT_ID} />);
    expect(screen.getByText('Molestia lumbar leve')).toBeInTheDocument();
  });
});
