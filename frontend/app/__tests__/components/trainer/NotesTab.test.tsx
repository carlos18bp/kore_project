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
jest.mock('@/lib/stores/nutritionStore', () => ({ useNutritionStore: jest.fn(() => ({
  entries: [],
  fetchClientEntries: jest.fn(),
  approveEntry: jest.fn().mockResolvedValue(undefined),
})) }));
jest.mock('@/app/components/trainer/MessageComposerCard', () => ({
  __esModule: true,
  default: ({ onSubmit }: { onSubmit: (m: string, t: string) => Promise<void> }) => (
    <button type="button" onClick={() => onSubmit('Buen trabajo', 'manual')}>composer-send</button>
  ),
}));

// The global gsap mock in jest.setup.ts is missing `fromTo` (used by NotesTab's
// Composer to fade view/edit transitions). Re-mock locally so it includes it.
jest.mock('gsap', () => {
  const fn = jest.fn();
  const obj = { fromTo: fn, to: fn, from: fn, set: fn, registerPlugin: fn };
  return { __esModule: true, default: obj, gsap: obj };
});

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
    // Stubs needed by Programa/Nutricion sections (not navigated to in these tests,
    // but kept here so swapping tabs in future tests doesn't blow up).
    clientMonthlyPrograms: {},
    monthlyProgramsLoading: false,
    fetchClientMonthlyPrograms: jest.fn(),
    updateMonthlyProgramNote: jest.fn().mockResolvedValue(undefined),
    clientWeeklyPlans: {},
    weeklyPlansLoading: false,
    fetchClientWeeklyPlans: jest.fn(),
    updateWeeklyPlanNote: jest.fn().mockResolvedValue(undefined),
    updateTrainerMessage: jest.fn().mockResolvedValue(undefined),
    deleteTrainerMessage: jest.fn().mockResolvedValue(undefined),
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

/**
 * Click one of the top-level sub-tabs (Sesiones / Programa / Nutrición / Evaluaciones).
 * `sesiones` is the default tab on mount, so it does not need an explicit click.
 */
async function goToTab(name: 'Sesiones' | 'Programa' | 'Nutrición' | 'Evaluaciones') {
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name }));
  });
}

describe('NotesTab', () => {
  beforeEach(() => jest.clearAllMocks());

  it('shows the session-objective card with the next pending session', () => {
    setup({ sessions: [{ id: 99, status: 'pending', starts_at: FUTURE_ISO, package_title: 'Plan Elite', session_objective: 'Foco en core' }] });
    renderTab();

    // Kicker renders as "Sesión activa · Plan Elite" in a single text node, so we
    // match against a regex to assert the package title bubbles up to the composer.
    expect(screen.getByText(/Plan Elite/)).toBeInTheDocument();
    // With a saved objective the composer starts in view-mode, showing the note
    // text in a <p>, not a textarea — so assert by visible text.
    expect(screen.getByText('Foco en core')).toBeInTheDocument();
  });

  it('shows a placeholder when there is no upcoming session', () => {
    setup({ sessions: [] });
    renderTab();

    // The empty state uses the centralized <EmptyState /> component with the
    // module-specific title for sessions.
    expect(screen.getByText('Sin próximas sesiones')).toBeInTheDocument();
  });

  it('saves the session objective and shows the saved indicator', async () => {
    const { updateSessionObjective } = setup({
      // Start with an empty objective so the composer mounts in edit-mode and
      // the save indicator stays visible (saving a non-empty value flips the
      // composer back to view-mode, hiding the "Guardar" / "✓ Guardado" button).
      sessions: [{ id: 99, status: 'pending', starts_at: FUTURE_ISO, package_title: 'Plan Elite', session_objective: '' }],
    });
    renderTab();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    });

    expect(updateSessionObjective).toHaveBeenCalledWith(CLIENT_ID, 99, '');
    await waitFor(() => {
      expect(screen.getByRole('button', { name: '✓ Guardado' })).toBeInTheDocument();
    });
  });

  it('renders the four module note cards', async () => {
    // The four module composer cards only render their titles when there is at
    // least one evaluation item per module — otherwise the section shows its
    // module-specific empty state instead of the composer.
    setup({
      anthropEvals: [{ id: 1, evaluation_date: '2026-03-15', notes: '' }],
      posturEvals: [{ id: 2, evaluation_date: '2026-03-15', notes: '' }],
      fisicaEvals: [{ id: 3, evaluation_date: '2026-03-15', notes: '' }],
      parqList: [{ id: 4, created_at: '2026-03-15', additional_notes: '' }],
    });
    renderTab();

    await goToTab('Evaluaciones');

    expect(screen.getByText('Antropometría')).toBeInTheDocument();
    expect(screen.getByText('Posturometría')).toBeInTheDocument();
    // Source renders "Evaluación física" with a lowercase "f".
    expect(screen.getByText('Evaluación física')).toBeInTheDocument();
    expect(screen.getByText('PAR-Q+')).toBeInTheDocument();
  });

  it('shows the empty state in every module card when no evaluations exist', async () => {
    setup();
    renderTab();

    await goToTab('Evaluaciones');

    // Each module owns a module-specific empty-state title (centralized via <EmptyState />).
    expect(screen.getByText('Sin evaluaciones antropométricas')).toBeInTheDocument();
    expect(screen.getByText('Sin evaluaciones posturales')).toBeInTheDocument();
    expect(screen.getByText('Sin evaluaciones físicas')).toBeInTheDocument();
    expect(screen.getByText('Sin registros PAR-Q+')).toBeInTheDocument();
  });

  it('prefills a module note textarea from the latest evaluation', async () => {
    setup({ anthropEvals: [{ id: 1, evaluation_date: '2026-03-15', notes: 'Buen progreso muscular' }] });
    renderTab();

    await goToTab('Evaluaciones');

    // With a saved note, the Composer renders in view-mode — the note text lives
    // inside a <p>, so assert via getByText (not getByDisplayValue).
    expect(screen.getByText('Buen progreso muscular')).toBeInTheDocument();
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

    // Seen badge now uses a check mark: "✓ Visto".
    expect(screen.getByText('✓ Visto')).toBeInTheDocument();
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

  it('shows a loading spinner in the messages section when messages are loading', () => {
    setup();
    renderTab({ messages: [], messagesLoading: true });

    const spinner = document.querySelector('.animate-spin');
    expect(spinner).toBeInTheDocument();
  });

  it('renders a post_milestone trigger-type message with its label', () => {
    setup();
    renderTab({
      messages: [
        { id: 2, message: 'Hito alcanzado', trigger_type: 'post_milestone', seen_by_customer: false, created_at: '2026-04-02T10:00:00Z' },
      ],
    });

    expect(screen.getByText('Post hito')).toBeInTheDocument();
  });

  it('renders a manual trigger-type message with the fallback Manual label', () => {
    setup();
    renderTab({
      messages: [
        { id: 3, message: 'Mensaje directo', trigger_type: 'manual', seen_by_customer: false, created_at: '2026-04-03T10:00:00Z' },
      ],
    });

    expect(screen.getByText('Manual')).toBeInTheDocument();
  });

  it('renders one message row per item in the messages array', () => {
    setup();
    renderTab({
      messages: [
        { id: 10, message: 'Primer mensaje', trigger_type: 'manual', seen_by_customer: false, created_at: '2026-04-04T10:00:00Z' },
        { id: 11, message: 'Segundo mensaje', trigger_type: 'post_session', seen_by_customer: true, created_at: '2026-04-05T10:00:00Z' },
        { id: 12, message: 'Tercer mensaje', trigger_type: 'post_milestone', seen_by_customer: false, created_at: '2026-04-06T10:00:00Z' },
      ],
    });

    expect(screen.getByText('Primer mensaje')).toBeInTheDocument();
    expect(screen.getByText('Segundo mensaje')).toBeInTheDocument();
    expect(screen.getByText('Tercer mensaje')).toBeInTheDocument();
  });

  it('shows a textarea for a module that has evaluation data', async () => {
    setup({
      posturEvals: [{ id: 5, evaluation_date: '2026-02-20', notes: 'Postura correcta' }],
    });
    renderTab();

    await goToTab('Evaluaciones');

    // With a saved note the composer starts in view-mode; click "Editar nota"
    // to reveal the textarea, then assert it carries the saved value.
    const editButtons = screen.getAllByRole('button', { name: 'Editar nota' });
    await act(async () => {
      fireEvent.click(editButtons[0]);
    });

    expect(screen.getByDisplayValue('Postura correcta')).toBeInTheDocument();
  });
});
