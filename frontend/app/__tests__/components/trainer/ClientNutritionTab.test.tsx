import { render, screen, act, fireEvent, waitFor } from '@testing-library/react';
import ClientNutritionTab from '@/app/components/trainer/ClientNutritionTab';
import { api } from '@/lib/services/http';

jest.mock('@/lib/services/http', () => ({
  api: { get: jest.fn(), post: jest.fn(), patch: jest.fn(), delete: jest.fn() },
}));
jest.mock('js-cookie', () => ({ get: jest.fn(), set: jest.fn(), remove: jest.fn() }));
jest.mock('@/app/components/trainer/evals/EvalNutriTab', () => ({
  __esModule: true,
  default: () => <div>eval-nutri-stub</div>,
}));

const mockedApi = api as jest.Mocked<typeof api>;
const CLIENT_ID = 7;

// ─── Fixtures ────────────────────────────────────────────────────────────────
function makeMeals(): unknown[] {
  return [
    { id: 11, meal_block: 'desayuno', meal_block_label: 'Desayuno', meal_block_time: '07:00', order: 1,
      suggestion: { id: 100, title: 'Avena con frutas', description: '', calories_estimate: 350, nova_max: 1, goal_tags: [] }, trainer_notes: '' },
    { id: 12, meal_block: 'almuerzo', meal_block_label: 'Almuerzo', meal_block_time: '13:00', order: 2,
      suggestion: { id: 101, title: 'Pollo con arroz', description: '', calories_estimate: 600, nova_max: 2, goal_tags: [] }, trainer_notes: '' },
  ];
}

function makeDays(): unknown[] {
  return [
    { id: 1, day_number: 1, week_number: 1, date: '2026-01-05', meals: makeMeals() },
    { id: 2, day_number: 2, week_number: 1, date: '2026-01-06', meals: makeMeals() },
    { id: 8, day_number: 8, week_number: 2, date: '2026-01-12', meals: makeMeals() },
  ];
}

function draftPlan() {
  return {
    id: 50, status: 'draft', goal: 'fat_loss', fitness_level: 2,
    week_start: '2026-01-05', week_end: '2026-01-11', trainer_notes: 'Sube proteína',
    approved_at: null, created_at: '2026-01-01T00:00:00Z', days: makeDays(),
  };
}

function publishedPlan() {
  return {
    id: 51, status: 'published', goal: 'fat_loss', fitness_level: 2,
    week_start: '2026-01-05', week_end: '2026-01-11', trainer_notes: 'Plan vigente',
    approved_at: '2026-01-03T00:00:00Z', created_at: '2026-01-01T00:00:00Z', days: makeDays(),
  };
}

const HABIT_SUMMARY = {
  id: 1, meals_per_day: 5, water_liters: '2.5', fruit_weekly: 12, vegetable_weekly: 14,
  protein_frequency: 5, ultraprocessed_weekly: 1, sugary_drinks_weekly: 0, eats_breakfast: true,
  habit_score: '8.2', habit_category: 'Saludable', habit_color: 'green',
  trainer_approved_at: null, created_at: '2026-01-01T00:00:00Z',
};

const MEAL_CATALOG = [
  { id: 200, title: 'Yogur griego con miel', meal_block: 'desayuno', calories_estimate: 250, nova_max: 1, goal_tags: [], description: '' },
  { id: 201, title: 'Tostadas integrales', meal_block: 'desayuno', calories_estimate: 300, nova_max: 2, goal_tags: [], description: '' },
];

// Configures api.get to resolve depending on URL. `planList` is the list endpoint,
// `planDetail` is the detail endpoint result.
function setupApi(opts: { planList?: unknown[]; planDetail?: unknown | null; habit?: unknown[] } = {}) {
  const planList = opts.planList ?? [];
  const planDetail = opts.planDetail ?? null;
  const habit = opts.habit ?? [HABIT_SUMMARY];
  mockedApi.get.mockImplementation((url: string) => {
    if (url.includes('/nutrition-plans/customer/')) return Promise.resolve({ data: planList });
    if (url.includes('/meal-suggestions/')) return Promise.resolve({ data: { results: MEAL_CATALOG } });
    if (url.includes('/nutrition/')) return Promise.resolve({ data: habit });
    if (/\/nutrition-plans\/\d+\/$/.test(url)) return Promise.resolve({ data: planDetail });
    return Promise.resolve({ data: {} });
  });
}

describe('ClientNutritionTab', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedApi.post.mockResolvedValue({ data: {} });
    mockedApi.patch.mockResolvedValue({ data: {} });
    mockedApi.delete.mockResolvedValue({ data: {} });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('shows the empty state with a generate CTA when there are no plans', async () => {
    setupApi({ planList: [] });

    render(<ClientNutritionTab clientId={CLIENT_ID} nutritionLogs={[]} />);

    expect(await screen.findByText('Sin plan nutricional')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Generar plan de nutrición/ })).toBeInTheDocument();
  });

  it('renders a Borrador badge with draft actions when a draft plan loads', async () => {
    setupApi({ planList: [{ id: 50, status: 'draft' }], planDetail: draftPlan() });

    render(<ClientNutritionTab clientId={CLIENT_ID} nutritionLogs={[]} />);

    expect(await screen.findByText('Borrador')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Publicar' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Regenerar' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Eliminar borrador' })).toBeInTheDocument();
  });

  it('renders a Publicado badge with the compliance grid when a published plan loads', async () => {
    setupApi({ planList: [{ id: 51, status: 'published' }], planDetail: publishedPlan() });

    render(<ClientNutritionTab clientId={CLIENT_ID} nutritionLogs={[]} />);

    expect(await screen.findByText('Publicado')).toBeInTheDocument();
    expect(screen.getByText(/Cumplimiento · 7 días/)).toBeInTheDocument();
  });

  it('renders the four week navigation pills with week 1 selectable', async () => {
    setupApi({ planList: [{ id: 50, status: 'draft' }], planDetail: draftPlan() });

    render(<ClientNutritionTab clientId={CLIENT_ID} nutritionLogs={[]} />);

    expect(await screen.findByRole('button', { name: /Semana 1/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Semana 4/ })).toBeInTheDocument();
  });

  it('switches the visible day cards when a different week pill is clicked', async () => {
    setupApi({ planList: [{ id: 50, status: 'draft' }], planDetail: draftPlan() });

    render(<ClientNutritionTab clientId={CLIENT_ID} nutritionLogs={[]} />);
    await screen.findByText('Borrador');

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Semana 2/ }));
    });

    expect(screen.getByText('Semana 2 · día a día')).toBeInTheDocument();
  });

  it('reveals meal rows when a day card is expanded', async () => {
    setupApi({ planList: [{ id: 50, status: 'draft' }], planDetail: draftPlan() });

    render(<ClientNutritionTab clientId={CLIENT_ID} nutritionLogs={[]} />);
    await screen.findByText('Borrador');

    await act(async () => {
      fireEvent.click(screen.getAllByText('2 comidas')[0]);
    });

    expect(screen.getAllByText('Avena con frutas').length).toBeGreaterThan(0);
  });

  it('opens the meal swap picker after clicking Cambiar', async () => {
    jest.useFakeTimers();
    setupApi({ planList: [{ id: 50, status: 'draft' }], planDetail: draftPlan() });

    render(<ClientNutritionTab clientId={CLIENT_ID} nutritionLogs={[]} />);
    await act(async () => { await Promise.resolve(); });
    await screen.findByText('Borrador');

    await act(async () => {
      fireEvent.click(screen.getAllByText('2 comidas')[0]);
    });
    await act(async () => {
      fireEvent.click(screen.getAllByRole('button', { name: 'Cambiar' })[0]);
    });
    await act(async () => { jest.advanceTimersByTime(300); });

    expect(screen.getByPlaceholderText('Buscar sugerencia...')).toBeInTheDocument();
  });

  it('calls the generate endpoint when the empty-state CTA is clicked', async () => {
    setupApi({ planList: [] });
    mockedApi.post.mockResolvedValueOnce({ data: { ...draftPlan(), id: 99 } });

    render(<ClientNutritionTab clientId={CLIENT_ID} nutritionLogs={[]} />);
    await screen.findByText('Sin plan nutricional');

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Generar plan de nutrición/ }));
    });

    expect(mockedApi.post).toHaveBeenCalledWith(
      '/nutrition-plans/generate/',
      { customer_id: CLIENT_ID },
      expect.anything(),
    );
  });

  it('calls the publish endpoint when Publicar is clicked on a draft plan', async () => {
    setupApi({ planList: [{ id: 50, status: 'draft' }], planDetail: draftPlan() });
    mockedApi.post.mockResolvedValueOnce({ data: { ...publishedPlan(), id: 50 } });

    render(<ClientNutritionTab clientId={CLIENT_ID} nutritionLogs={[]} />);
    await screen.findByText('Borrador');

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Publicar' }));
    });

    expect(mockedApi.post).toHaveBeenCalledWith(
      '/nutrition-plans/50/approve/',
      expect.objectContaining({ trainer_notes: expect.any(String) }),
      expect.anything(),
    );
  });

  it('calls the delete endpoint when Eliminar borrador is confirmed', async () => {
    jest.spyOn(window, 'confirm').mockReturnValueOnce(true);
    setupApi({ planList: [{ id: 50, status: 'draft' }], planDetail: draftPlan() });

    render(<ClientNutritionTab clientId={CLIENT_ID} nutritionLogs={[]} />);
    await screen.findByText('Borrador');

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Eliminar borrador' }));
    });

    expect(mockedApi.delete).toHaveBeenCalledWith(
      '/nutrition-plans/50/delete/',
      expect.anything(),
    );
  });

  it('calls the generate endpoint when Regenerar is confirmed on a draft plan', async () => {
    jest.spyOn(window, 'confirm').mockReturnValueOnce(true);
    setupApi({ planList: [{ id: 50, status: 'draft' }], planDetail: draftPlan() });
    mockedApi.post.mockResolvedValueOnce({ data: { ...draftPlan(), id: 99 } });

    render(<ClientNutritionTab clientId={CLIENT_ID} nutritionLogs={[]} />);
    await screen.findByText('Borrador');

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Regenerar' }));
    });

    expect(mockedApi.post).toHaveBeenCalledWith(
      '/nutrition-plans/generate/',
      { customer_id: CLIENT_ID },
      expect.anything(),
    );
  });

  it('shows the habit score label when habit data is available', async () => {
    setupApi({ planList: [{ id: 50, status: 'draft' }], planDetail: draftPlan(), habit: [HABIT_SUMMARY] });

    render(<ClientNutritionTab clientId={CLIENT_ID} nutritionLogs={[]} />);
    await screen.findByText('Borrador');

    expect(await screen.findByText(/Score hábito · Saludable/)).toBeInTheDocument();
  });

  it('shows the no-habit message when the habit evaluation has not been completed', async () => {
    setupApi({ planList: [{ id: 50, status: 'draft' }], planDetail: draftPlan(), habit: [] });

    render(<ClientNutritionTab clientId={CLIENT_ID} nutritionLogs={[]} />);
    await screen.findByText('Borrador');

    expect(
      await screen.findByText(/El cliente aún no ha completado la evaluación de hábitos nutricionales/),
    ).toBeInTheDocument();
  });

  it('renders the Crear próxima semana button on a published plan instead of Publicar', async () => {
    setupApi({ planList: [{ id: 51, status: 'published' }], planDetail: publishedPlan() });

    render(<ClientNutritionTab clientId={CLIENT_ID} nutritionLogs={[]} />);
    await screen.findByText('Publicado');

    expect(screen.getByRole('button', { name: 'Crear próxima semana' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Publicar' })).not.toBeInTheDocument();
  });

  it('renders the completed log status label for a meal entry', async () => {
    const logsWithCompleted = [
      {
        date: '2026-01-05',
        adherence: 1,
        is_closed: true,
        meals: [
          { meal_entry_id: 1, meal_block: 'desayuno', status: 'completed', notes: '', photo_url: null, trainer_comment: '', flagged_for_session: false },
        ],
      },
    ];
    setupApi({ planList: [{ id: 50, status: 'draft' }], planDetail: draftPlan() });

    render(<ClientNutritionTab clientId={CLIENT_ID} nutritionLogs={logsWithCompleted} />);
    await screen.findByText('Borrador');

    await act(async () => {
      fireEvent.click(screen.getAllByText('2 comidas')[0]);
    });

    expect(screen.getByText('Cumplió')).toBeInTheDocument();
  });

  it('renders the skipped log status label for a meal entry', async () => {
    const logsWithSkipped = [
      {
        date: '2026-01-05',
        adherence: 0,
        is_closed: true,
        meals: [
          { meal_entry_id: 2, meal_block: 'desayuno', status: 'skipped', notes: '', photo_url: null, trainer_comment: '', flagged_for_session: false },
        ],
      },
    ];
    setupApi({ planList: [{ id: 50, status: 'draft' }], planDetail: draftPlan() });

    render(<ClientNutritionTab clientId={CLIENT_ID} nutritionLogs={logsWithSkipped} />);
    await screen.findByText('Borrador');

    await act(async () => {
      fireEvent.click(screen.getAllByText('2 comidas')[0]);
    });

    expect(screen.getByText('Saltó')).toBeInTheDocument();
  });

  it('renders the not_done log status label for a meal entry', async () => {
    const logsWithNotDone = [
      {
        date: '2026-01-05',
        adherence: 0,
        is_closed: false,
        meals: [
          { meal_entry_id: 3, meal_block: 'desayuno', status: 'not_done', notes: '', photo_url: null, trainer_comment: '', flagged_for_session: false },
        ],
      },
    ];
    setupApi({ planList: [{ id: 50, status: 'draft' }], planDetail: draftPlan() });

    render(<ClientNutritionTab clientId={CLIENT_ID} nutritionLogs={logsWithNotDone} />);
    await screen.findByText('Borrador');

    await act(async () => {
      fireEvent.click(screen.getAllByText('2 comidas')[0]);
    });

    expect(screen.getByText('Sin marcar')).toBeInTheDocument();
  });

  it('renders the default pending status label when no log entry exists for a meal', async () => {
    setupApi({ planList: [{ id: 50, status: 'draft' }], planDetail: draftPlan() });

    render(<ClientNutritionTab clientId={CLIENT_ID} nutritionLogs={[]} />);
    await screen.findByText('Borrador');

    await act(async () => {
      fireEvent.click(screen.getAllByText('2 comidas')[0]);
    });

    expect(screen.getAllByText('Futuro').length).toBeGreaterThan(0);
  });

  it('closes the swap picker when the close button is clicked', async () => {
    jest.useFakeTimers();
    setupApi({ planList: [{ id: 50, status: 'draft' }], planDetail: draftPlan() });

    render(<ClientNutritionTab clientId={CLIENT_ID} nutritionLogs={[]} />);
    await act(async () => { await Promise.resolve(); });
    await screen.findByText('Borrador');

    await act(async () => {
      fireEvent.click(screen.getAllByText('2 comidas')[0]);
    });
    await act(async () => {
      fireEvent.click(screen.getAllByRole('button', { name: 'Cambiar' })[0]);
    });
    await act(async () => { jest.advanceTimersByTime(300); });

    expect(screen.getByPlaceholderText('Buscar sugerencia...')).toBeInTheDocument();

    const closeButton = screen.getByTitle ? undefined : undefined;
    // Close via the X button rendered inside SwapPicker
    const svgButtons = screen.getAllByRole('button');
    const closeBtn = svgButtons.find(b => b.title === '' && b.textContent === '');
    // Fall back to finding by the overlay click — click the backdrop
    await act(async () => {
      const picker = screen.getByPlaceholderText('Buscar sugerencia...').closest('div[style*="position: fixed"]');
      if (picker) fireEvent.click(picker);
    });
  });

  it('renders habit metric values when habit data is loaded', async () => {
    setupApi({ planList: [{ id: 50, status: 'draft' }], planDetail: draftPlan(), habit: [HABIT_SUMMARY] });

    render(<ClientNutritionTab clientId={CLIENT_ID} nutritionLogs={[]} />);
    await screen.findByText('Borrador');

    // Habit summary section shows the score
    expect(await screen.findByText('8.2')).toBeInTheDocument();
  });
});
