import { render, screen, act, fireEvent, waitFor } from '@testing-library/react';
import NotesTab from '@/app/components/trainer/NotesTab';
import { useAnthropometryStore } from '@/lib/stores/anthropometryStore';
import { usePosturometryStore } from '@/lib/stores/posturometryStore';
import { usePhysicalEvaluationStore } from '@/lib/stores/physicalEvaluationStore';
import { useParqStore } from '@/lib/stores/parqStore';
import { useTrainerStore } from '@/lib/stores/trainerStore';

jest.mock('@/lib/stores/anthropometryStore', () => ({ useAnthropometryStore: jest.fn() }));
jest.mock('@/lib/stores/posturometryStore', () => ({ usePosturometryStore: jest.fn() }));
jest.mock('@/lib/stores/physicalEvaluationStore', () => ({ usePhysicalEvaluationStore: jest.fn() }));
jest.mock('@/lib/stores/parqStore', () => ({ useParqStore: jest.fn() }));
jest.mock('@/lib/stores/trainerStore', () => ({ useTrainerStore: jest.fn() }));
jest.mock('@/app/components/trainer/MessageComposerCard', () => ({
  __esModule: true,
  default: ({ onSubmit }: { onSubmit: (m: string, t: string) => Promise<void> }) => (
    <button type="button" onClick={() => onSubmit('Buen trabajo', 'manual')}>composer-send</button>
  ),
}));

const mAnthrop = useAnthropometryStore as unknown as jest.Mock;
const mPostur = usePosturometryStore as unknown as jest.Mock;
const mFisica = usePhysicalEvaluationStore as unknown as jest.Mock;
const mParq = useParqStore as unknown as jest.Mock;
const mTrainer = useTrainerStore as unknown as jest.Mock;

const CLIENT_ID = 42;
const FUTURE_ISO = new Date(Date.now() + 24 * 3600 * 1000).toISOString();

function setup(overrides: {
  anthropEvals?: unknown[];
  posturEvals?: unknown[];
  fisicaEvals?: unknown[];
  parqList?: unknown[];
  sessions?: unknown[];
  updateSessionObjective?: jest.Mock;
} = {}) {
  mAnthrop.mockReturnValue({ evaluations: overrides.anthropEvals ?? [], fetchEvaluations: jest.fn(), updateEvaluation: jest.fn().mockResolvedValue(undefined) });
  mPostur.mockReturnValue({ evaluations: overrides.posturEvals ?? [], fetchEvaluations: jest.fn(), updateEvaluation: jest.fn().mockResolvedValue(undefined) });
  mFisica.mockReturnValue({ evaluations: overrides.fisicaEvals ?? [], fetchEvaluations: jest.fn(), updateEvaluation: jest.fn().mockResolvedValue(undefined) });
  mParq.mockReturnValue({ assessments: overrides.parqList ?? [], fetchClientAssessments: jest.fn(), updateNotes: jest.fn().mockResolvedValue(undefined) });
  const updateSessionObjective = overrides.updateSessionObjective ?? jest.fn().mockResolvedValue(undefined);
  mTrainer.mockReturnValue({
    clientSessionsFull: { [CLIENT_ID]: overrides.sessions ?? [] },
    sessionsFullLoading: false,
    fetchClientSessionsFull: jest.fn(),
    updateSessionObjective,
  });
  return { updateSessionObjective };
}

function renderTab(props: Partial<React.ComponentProps<typeof NotesTab>> = {}) {
  return render(
    <NotesTab
      clientId={CLIENT_ID}
      onSendMessage={props.onSendMessage ?? jest.fn().mockResolvedValue(undefined)}
      messages={props.messages ?? []}
      messagesLoading={props.messagesLoading ?? false}
    />,
  );
}

describe('NotesTab', () => {
  beforeEach(() => jest.clearAllMocks());

  it('shows the session-objective card with the next pending session', () => {
    setup({ sessions: [{ id: 99, status: 'pending', starts_at: FUTURE_ISO, package_title: 'Plan Elite', session_objective: 'Foco en core' }] });
    renderTab();

    expect(screen.getByText('Plan Elite')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Foco en core')).toBeInTheDocument();
  });

  it('shows a placeholder when there is no upcoming session', () => {
    setup({ sessions: [] });
    renderTab();

    expect(screen.getByText('Sin sesiones próximas programadas.')).toBeInTheDocument();
  });

  it('saves the session objective and shows the saved indicator', async () => {
    const { updateSessionObjective } = setup({
      sessions: [{ id: 99, status: 'pending', starts_at: FUTURE_ISO, package_title: 'Plan Elite', session_objective: 'Foco' }],
    });
    renderTab();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    });

    expect(updateSessionObjective).toHaveBeenCalledWith(CLIENT_ID, 99, 'Foco');
    expect(screen.getByRole('button', { name: '✓ Guardado' })).toBeInTheDocument();
  });

  it('renders the four module note cards', () => {
    setup();
    renderTab();

    expect(screen.getByText('Antropometría')).toBeInTheDocument();
    expect(screen.getByText('Posturometría')).toBeInTheDocument();
    expect(screen.getByText('Evaluación Física')).toBeInTheDocument();
    expect(screen.getByText('PAR-Q+')).toBeInTheDocument();
  });

  it('shows the empty state in every module card when no evaluations exist', () => {
    setup();
    renderTab();

    expect(screen.getAllByText('Sin evaluaciones registradas aún.')).toHaveLength(4);
  });

  it('prefills a module note textarea from the latest evaluation', () => {
    setup({ anthropEvals: [{ id: 1, evaluation_date: '2026-03-15', notes: 'Buen progreso muscular' }] });
    renderTab();

    expect(screen.getByDisplayValue('Buen progreso muscular')).toBeInTheDocument();
  });

  it('renders a message with its trigger-type label', () => {
    setup();
    renderTab({ messages: [{ id: 1, message: 'Buen trabajo', trigger_type: 'post_session', seen_by_customer: false, created_at: '2026-04-01T10:00:00Z' }] });

    expect(screen.getByText('Buen trabajo')).toBeInTheDocument();
    expect(screen.getByText('Post sesión')).toBeInTheDocument();
  });

  it('marks an unseen message as pending', () => {
    setup();
    renderTab({ messages: [{ id: 1, message: 'Hola', trigger_type: 'manual', seen_by_customer: false, created_at: '2026-04-01T10:00:00Z' }] });

    expect(screen.getByText('Pendiente')).toBeInTheDocument();
  });

  it('marks a seen message as visto', () => {
    setup();
    renderTab({ messages: [{ id: 1, message: 'Hola', trigger_type: 'manual', seen_by_customer: true, created_at: '2026-04-01T10:00:00Z' }] });

    expect(screen.getByText('Visto')).toBeInTheDocument();
  });

  it('shows the empty state when there are no messages', () => {
    setup();
    renderTab({ messages: [] });

    expect(screen.getByText('Sin mensajes enviados')).toBeInTheDocument();
  });

  it('forwards a composer submission to onSendMessage', async () => {
    setup();
    const onSendMessage = jest.fn().mockResolvedValue(undefined);
    renderTab({ onSendMessage });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'composer-send' }));
    });

    expect(onSendMessage).toHaveBeenCalledWith('Buen trabajo', 'manual');
  });
});
