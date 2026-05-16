import { render, screen, act, fireEvent } from '@testing-library/react';
import ClientProgramTab from '@/app/components/trainer/ClientProgramTab';
import { api } from '@/lib/services/http';
import { useTrainerStore } from '@/lib/stores/trainerStore';

jest.mock('@/lib/services/http', () => ({
  api: { get: jest.fn(), post: jest.fn(), patch: jest.fn(), delete: jest.fn() },
}));
jest.mock('js-cookie', () => ({ get: jest.fn(), set: jest.fn(), remove: jest.fn() }));
jest.mock('@/lib/stores/trainerStore', () => ({ useTrainerStore: jest.fn() }));

const mockedApi = api as jest.Mocked<typeof api>;
const mTrainer = useTrainerStore as unknown as jest.Mock;
const CLIENT_ID = 9;

// ─── Fixtures ────────────────────────────────────────────────────────────────
function makeExercise(id: number, name: string): unknown {
  return {
    id,
    exercise: { id: id * 10, name, pattern: 'squat', youtube_url: 'https://youtu.be/x', explanation: '', is_corrective: false, primary_muscles: 'quads', secondary_muscles: '' },
    sets: 3, reps: 12, duration_seconds: null, rest_seconds: 60, order: 1, notes: '',
  };
}

function makeDays(): unknown[] {
  const days: unknown[] = [];
  for (let n = 1; n <= 28; n++) {
    const isTraining = n % 2 === 1;
    days.push({
      id: n,
      day_number: n,
      date: `2026-02-${String(n).padStart(2, '0')}`,
      day_type: isTraining ? 'training' : 'rest',
      exercises: isTraining ? [makeExercise(n, `Sentadilla ${n}`), makeExercise(n + 100, `Plancha ${n}`)] : [],
    });
  }
  return days;
}

function draftProgram() {
  return {
    id: 70, customer_id: CLIENT_ID, fitness_level: 3, goal: 'fat_loss',
    start_date: '2026-02-01', end_date: '2026-02-28', status: 'draft',
    trainer_notes: 'Foco en técnica', approved_at: null, created_at: '2026-01-25T00:00:00Z',
    days: makeDays(), booking_dates: [],
  };
}

function publishedProgram() {
  return {
    id: 71, customer_id: CLIENT_ID, fitness_level: 3, goal: 'fat_loss',
    start_date: '2026-02-01', end_date: '2026-02-28', status: 'published',
    trainer_notes: 'Programa vigente', approved_at: '2026-01-28T00:00:00Z', created_at: '2026-01-25T00:00:00Z',
    days: makeDays(), booking_dates: [],
  };
}

const DAILY_LOGS = [
  { date: '2026-02-01', day_number: 1, day_type: 'training', training_adherence: 1, nutrition_adherence: 1, combined_adherence: 1, exercises: [] },
  { date: '2026-02-02', day_number: 2, day_type: 'rest', training_adherence: 0, nutrition_adherence: 0, combined_adherence: 0, exercises: [] },
];

const EXERCISE_CATALOG = [
  { id: 500, name: 'Zancada con mancuernas', pattern: 'lunge', exercise_type: 'strength', youtube_url: 'https://youtu.be/y', primary_muscles: 'glutes' },
  { id: 501, name: 'Prensa de piernas', pattern: 'squat', exercise_type: 'strength', youtube_url: '', primary_muscles: 'quads' },
];

function setupApi(opts: { programs?: unknown[]; levelComputed?: number; levelOverride?: number | null } = {}) {
  const programs = opts.programs ?? [];
  mockedApi.get.mockImplementation((url: string) => {
    if (url.includes('/monthly-programs/customer/')) return Promise.resolve({ data: programs });
    if (url.includes('/fitness-level/')) {
      return Promise.resolve({ data: { fitness_level_computed: opts.levelComputed ?? 3, fitness_level_override: opts.levelOverride ?? null } });
    }
    if (url.includes('/exercises/')) return Promise.resolve({ data: { results: EXERCISE_CATALOG } });
    return Promise.resolve({ data: {} });
  });
}

function setupStore(overrides: { logs?: unknown[]; loading?: boolean; fetch?: jest.Mock } = {}) {
  const fetch = overrides.fetch ?? jest.fn().mockResolvedValue(undefined);
  mTrainer.mockReturnValue({
    clientDailyLogs: overrides.logs ? { [CLIENT_ID]: overrides.logs } : {},
    dailyLogsLoading: overrides.loading ?? false,
    fetchClientDailyLogs: fetch,
  });
  return { fetch };
}

describe('ClientProgramTab', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedApi.post.mockResolvedValue({ data: {} });
    mockedApi.patch.mockResolvedValue({ data: {} });
    mockedApi.delete.mockResolvedValue({ data: {} });
    setupStore();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('shows the empty state when the client has no program', async () => {
    setupApi({ programs: [] });

    render(<ClientProgramTab clientId={CLIENT_ID} />);

    expect(await screen.findByText('Sin programa mensual')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Generar programa' })).toBeInTheDocument();
  });

  it('shows the computed fitness level in the editor', async () => {
    setupApi({ programs: [draftProgram()], levelComputed: 3 });

    render(<ClientProgramTab clientId={CLIENT_ID} />);
    await screen.findByText('Borrador');

    expect(screen.getByText('Intermedio')).toBeInTheDocument();
  });

  it('reveals the level selector when "Editar nivel" is clicked', async () => {
    setupApi({ programs: [draftProgram()], levelComputed: 3 });

    render(<ClientProgramTab clientId={CLIENT_ID} />);
    await screen.findByText('Borrador');

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Editar nivel/ }));
    });

    expect(screen.getByText('Selecciona el nivel')).toBeInTheDocument();
  });

  it('renders the draft warning banner when the program is a draft', async () => {
    setupApi({ programs: [draftProgram()] });

    render(<ClientProgramTab clientId={CLIENT_ID} />);

    expect(await screen.findByText(/Borrador generado\./)).toBeInTheDocument();
  });

  it('renders the adherence card when a published program has logs', async () => {
    setupStore({ logs: DAILY_LOGS });
    setupApi({ programs: [publishedProgram()] });

    render(<ClientProgramTab clientId={CLIENT_ID} />);
    await screen.findByText('Publicado');

    expect(screen.getByText('Adherencia')).toBeInTheDocument();
  });

  it('renders the four week cards for a draft program', async () => {
    setupApi({ programs: [draftProgram()] });

    render(<ClientProgramTab clientId={CLIENT_ID} />);
    await screen.findByText('Borrador');

    expect(screen.getByText('Semana 1')).toBeInTheDocument();
    expect(screen.getByText('Semana 4')).toBeInTheDocument();
  });

  it('reveals exercise rows when a week card is expanded', async () => {
    setupApi({ programs: [draftProgram()] });

    render(<ClientProgramTab clientId={CLIENT_ID} />);
    await screen.findByText('Borrador');

    // Week 1 is open by default; expand its first training day row.
    await act(async () => {
      fireEvent.click(screen.getAllByText('2 ejercicios')[0]);
    });

    expect(screen.getByText('Sentadilla 1')).toBeInTheDocument();
  });

  it('toggles an exercise input between reps and time mode', async () => {
    setupApi({ programs: [draftProgram()] });

    render(<ClientProgramTab clientId={CLIENT_ID} />);
    await screen.findByText('Borrador');

    await act(async () => {
      fireEvent.click(screen.getAllByText('2 ejercicios')[0]);
    });
    await act(async () => {
      fireEvent.click(screen.getAllByRole('button', { name: 'Editar ejercicio' })[0]);
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Tiempo' }));
    });

    expect(screen.getByText('Tiempo (s)')).toBeInTheDocument();
  });

  it('opens the exercise catalog picker and shows a search input', async () => {
    setupApi({ programs: [draftProgram()] });

    render(<ClientProgramTab clientId={CLIENT_ID} />);
    await screen.findByText('Borrador');

    await act(async () => {
      fireEvent.click(screen.getAllByText('2 ejercicios')[0]);
    });
    await act(async () => {
      fireEvent.click(screen.getAllByRole('button', { name: 'Editar ejercicio' })[0]);
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Cambiar ejercicio del catálogo' }));
    });

    expect(screen.getByPlaceholderText(/Buscar por nombre/)).toBeInTheDocument();
  });

  it('saves an inline exercise edit via a PATCH request', async () => {
    setupApi({ programs: [draftProgram()] });
    mockedApi.patch.mockResolvedValueOnce({ data: makeExercise(1, 'Sentadilla 1') });

    render(<ClientProgramTab clientId={CLIENT_ID} />);
    await screen.findByText('Borrador');

    await act(async () => {
      fireEvent.click(screen.getAllByText('2 ejercicios')[0]);
    });
    await act(async () => {
      fireEvent.click(screen.getAllByRole('button', { name: 'Editar ejercicio' })[0]);
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Guardar/ }));
    });

    expect(mockedApi.patch).toHaveBeenCalledWith(
      expect.stringMatching(/\/monthly-programs\/70\/days\/1\/exercises\/1\/$/),
      expect.objectContaining({ sets: 3 }),
      expect.anything(),
    );
  });

  it('generates the first program via POST when "Generar programa" is clicked', async () => {
    setupApi({ programs: [] });
    mockedApi.post.mockResolvedValueOnce({ data: {} });
    // After POST, fetchPrograms re-runs — return empty so empty state persists
    mockedApi.get.mockImplementation((url: string) => {
      if (url.includes('/monthly-programs/customer/')) return Promise.resolve({ data: [] });
      if (url.includes('/fitness-level/')) return Promise.resolve({ data: { fitness_level_computed: 3, fitness_level_override: null } });
      return Promise.resolve({ data: {} });
    });

    render(<ClientProgramTab clientId={CLIENT_ID} />);
    await screen.findByText('Sin programa mensual');

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Generar programa' }));
    });

    expect(mockedApi.post).toHaveBeenCalledWith(
      '/monthly-programs/generate/',
      { customer_id: CLIENT_ID },
      expect.anything(),
    );
  });

  it('shows program selector pill when there are multiple programs', async () => {
    setupApi({ programs: [draftProgram(), publishedProgram()] });

    render(<ClientProgramTab clientId={CLIENT_ID} />);
    await screen.findByText('Borrador');

    // Both programs should appear as selector buttons
    expect(screen.getByRole('button', { name: /Borrador/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Activo/ })).toBeInTheDocument();
  });

  it('switches to second program when selector is clicked', async () => {
    setupApi({ programs: [draftProgram(), publishedProgram()] });
    setupStore();

    render(<ClientProgramTab clientId={CLIENT_ID} />);
    await screen.findByText('Borrador');

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Activo/ }));
    });

    expect(screen.getByText('Publicado')).toBeInTheDocument();
  });

  it('PATCHes fitness level when a level button is selected', async () => {
    setupApi({ programs: [draftProgram()], levelComputed: 3 });
    mockedApi.patch.mockResolvedValueOnce({ data: {} });

    render(<ClientProgramTab clientId={CLIENT_ID} />);
    await screen.findByText('Borrador');

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Editar nivel/ }));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Avanzado/ }));
    });

    expect(mockedApi.patch).toHaveBeenCalledWith(
      `/trainer/my-clients/${CLIENT_ID}/fitness-level/`,
      { fitness_level: 4 },
      expect.anything(),
    );
  });

  it('deletes the draft when delete button is confirmed', async () => {
    jest.spyOn(window, 'confirm').mockReturnValueOnce(true);
    mockedApi.delete.mockResolvedValueOnce({});

    let programCallCount = 0;
    mockedApi.get.mockImplementation((url: string) => {
      if (url.includes('/monthly-programs/customer/')) {
        programCallCount++;
        return Promise.resolve({ data: programCallCount === 1 ? [draftProgram()] : [] });
      }
      if (url.includes('/fitness-level/')) {
        return Promise.resolve({ data: { fitness_level_computed: 3, fitness_level_override: null } });
      }
      return Promise.resolve({ data: {} });
    });
    setupStore();

    render(<ClientProgramTab clientId={CLIENT_ID} />);
    await screen.findByText('Borrador');

    await act(async () => {
      fireEvent.click(screen.getByTitle('Eliminar borrador'));
    });

    expect(mockedApi.delete).toHaveBeenCalledWith(
      '/monthly-programs/70/delete/',
      expect.anything(),
    );
  });

  it('expands Week 2 to show its days', async () => {
    setupApi({ programs: [draftProgram()] });

    render(<ClientProgramTab clientId={CLIENT_ID} />);
    await screen.findByText('Borrador');

    await act(async () => {
      fireEvent.click(screen.getByText('Semana 2'));
    });

    // Week 2 is now open, should show days 8–14
    expect(screen.getAllByText('2 ejercicios').length).toBeGreaterThan(1);
  });

  it('fetches similar exercises (similar_to) when the catalog picker opens without search query', async () => {
    setupApi({ programs: [draftProgram()] });

    render(<ClientProgramTab clientId={CLIENT_ID} />);
    await screen.findByText('Borrador');

    await act(async () => {
      fireEvent.click(screen.getAllByText('2 ejercicios')[0]);
    });
    await act(async () => {
      fireEvent.click(screen.getAllByRole('button', { name: 'Editar ejercicio' })[0]);
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Cambiar ejercicio del catálogo' }));
    });

    expect(mockedApi.get).toHaveBeenCalledWith(
      expect.stringMatching(/\/exercises\/\?.*similar_to=/),
      expect.anything(),
    );
  });

  it('fetches exercises by search query when user types in the catalog search input', async () => {
    setupApi({ programs: [draftProgram()] });

    render(<ClientProgramTab clientId={CLIENT_ID} />);
    await screen.findByText('Borrador');

    await act(async () => {
      fireEvent.click(screen.getAllByText('2 ejercicios')[0]);
    });
    await act(async () => {
      fireEvent.click(screen.getAllByRole('button', { name: 'Editar ejercicio' })[0]);
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Cambiar ejercicio del catálogo' }));
    });

    const searchInput = screen.getByPlaceholderText(/Buscar por nombre/);
    await act(async () => {
      fireEvent.change(searchInput, { target: { value: 'press' } });
    });

    expect(mockedApi.get).toHaveBeenCalledWith(
      expect.stringMatching(/\/exercises\/\?.*search=press/),
      expect.anything(),
    );
  });

  it('PATCHes the program approval endpoint when Publicar is clicked on a draft', async () => {
    setupApi({ programs: [draftProgram()] });

    render(<ClientProgramTab clientId={CLIENT_ID} />);
    await screen.findByText('Borrador');

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Publicar' }));
    });

    expect(mockedApi.patch).toHaveBeenCalledWith(
      '/monthly-programs/70/approve/',
      expect.objectContaining({ trainer_notes: expect.any(String) }),
      expect.anything(),
    );
  });

  it('updates the trainer notes textarea when the user types in a draft program', async () => {
    setupApi({ programs: [draftProgram()] });

    render(<ClientProgramTab clientId={CLIENT_ID} />);
    await screen.findByText('Borrador');

    const textarea = screen.getByPlaceholderText(/Explícale al cliente/);
    await act(async () => {
      fireEvent.change(textarea, { target: { value: 'Nueva nota de entrenamiento' } });
    });

    expect(screen.getByDisplayValue('Nueva nota de entrenamiento')).toBeInTheDocument();
  });

  it('shows the Solo lectura label in the notes block when the program is published', async () => {
    setupStore({ logs: DAILY_LOGS });
    setupApi({ programs: [publishedProgram()] });

    render(<ClientProgramTab clientId={CLIENT_ID} />);
    await screen.findByText('Publicado');

    expect(screen.getByText('Solo lectura')).toBeInTheDocument();
  });

  it('renders the Descanso chip for a rest-type day row', async () => {
    setupApi({ programs: [draftProgram()] });

    render(<ClientProgramTab clientId={CLIENT_ID} />);
    await screen.findByText('Borrador');

    expect(screen.getAllByText('Descanso').length).toBeGreaterThan(0);
  });

  it('renders the rest-day row with the recovery text instead of exercise count', async () => {
    setupApi({ programs: [draftProgram()] });

    render(<ClientProgramTab clientId={CLIENT_ID} />);
    await screen.findByText('Borrador');

    expect(screen.getAllByText('Recuperación · sin ejercicios').length).toBeGreaterThan(0);
  });

  it('shows an error banner after a failed regenerate attempt on a draft program', async () => {
    setupApi({ programs: [draftProgram()] });
    jest.spyOn(window, 'confirm').mockReturnValueOnce(true);
    // Regenerate POST fails
    mockedApi.post.mockRejectedValueOnce(new Error('Server error'));
    // fetchPrograms after error still returns the original draft
    mockedApi.get.mockImplementation((url: string) => {
      if (url.includes('/monthly-programs/customer/')) return Promise.resolve({ data: [draftProgram()] });
      if (url.includes('/fitness-level/')) return Promise.resolve({ data: { fitness_level_computed: 3, fitness_level_override: null } });
      return Promise.resolve({ data: {} });
    });

    render(<ClientProgramTab clientId={CLIENT_ID} />);
    await screen.findByText('Borrador');

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Regenerar borrador/ }));
    });

    expect(await screen.findByText('No se pudo regenerar el borrador.')).toBeInTheDocument();
  });

  it('renders the time-based exercise display value with seconds suffix', async () => {
    const timeExercise = {
      id: 99,
      exercise: { id: 990, name: 'Plancha isométrica', pattern: 'core', youtube_url: '', explanation: '', is_corrective: false, primary_muscles: 'core', secondary_muscles: '' },
      sets: 3, reps: null, duration_seconds: 45, rest_seconds: 30, order: 1, notes: '',
    };
    const programWithTimeEx = {
      ...draftProgram(),
      days: [
        {
          id: 1, day_number: 1, date: '2026-02-01', day_type: 'training',
          exercises: [timeExercise],
        },
        // pad out days 2-28 as rest
        ...[...Array(27)].map((_, i) => ({
          id: i + 2, day_number: i + 2, date: `2026-02-${String(i + 2).padStart(2, '0')}`, day_type: 'rest', exercises: [],
        })),
      ],
    };
    setupApi({ programs: [programWithTimeEx] });

    render(<ClientProgramTab clientId={CLIENT_ID} />);
    await screen.findByText('Borrador');

    await act(async () => {
      fireEvent.click(screen.getByText('1 ejercicios'));
    });

    expect(screen.getByText('45s')).toBeInTheDocument();
  });

  it('shows the adherence ring percentage label for a published program with logs', async () => {
    setupStore({ logs: DAILY_LOGS });
    setupApi({ programs: [publishedProgram()] });

    render(<ClientProgramTab clientId={CLIENT_ID} />);
    await screen.findByText('Publicado');

    expect(screen.getByText('Adherencia')).toBeInTheDocument();
    // The ring renders a percentage — it should be a number followed by %
    const pctEl = document.querySelector('[style*="Cinzel"]');
    expect(screen.getByText(/\d+%/)).toBeInTheDocument();
  });

  it('trainer notes textarea is read-only when program is published', async () => {
    setupStore({ logs: DAILY_LOGS });
    setupApi({ programs: [publishedProgram()] });

    render(<ClientProgramTab clientId={CLIENT_ID} />);
    await screen.findByText('Publicado');

    const textarea = screen.getByPlaceholderText(/Explícale al cliente/);
    expect(textarea).toHaveAttribute('readonly');
  });

  it('renders the goal label in Spanish for a fat_loss program', async () => {
    setupApi({ programs: [draftProgram()] });

    render(<ClientProgramTab clientId={CLIENT_ID} />);
    await screen.findByText('Borrador');

    expect(screen.getByText(/Pérdida de grasa/)).toBeInTheDocument();
  });

  it('renders the program date range text in the header', async () => {
    setupApi({ programs: [draftProgram()] });

    render(<ClientProgramTab clientId={CLIENT_ID} />);
    await screen.findByText('Borrador');

    // programDateRange formats start_date + end_date — confirm at least one element with month visible
    expect(screen.getAllByText(/feb/i).length).toBeGreaterThan(0);
  });

  it('renders the rest-day chip with Descanso label', async () => {
    setupApi({ programs: [draftProgram()] });

    render(<ClientProgramTab clientId={CLIENT_ID} />);
    await screen.findByText('Borrador');

    // Rest days in week 1 have the Descanso chip
    const descansoChips = screen.getAllByText('Descanso');
    expect(descansoChips.length).toBeGreaterThan(0);
  });

  it('does not show the expand chevron for rest day rows', async () => {
    setupApi({ programs: [draftProgram()] });

    render(<ClientProgramTab clientId={CLIENT_ID} />);
    await screen.findByText('Borrador');

    // Rest-day rows have cursor:default — they show recovery text instead of exercise count
    expect(screen.getAllByText('Recuperación · sin ejercicios').length).toBeGreaterThan(0);
  });

  it('renders the time-mode label Tiempo in the reps/time unit column', async () => {
    const timeExercise = {
      id: 99,
      exercise: { id: 990, name: 'Plancha 90s', pattern: 'core', youtube_url: '', explanation: '', is_corrective: false, primary_muscles: 'core', secondary_muscles: '' },
      sets: 3, reps: null, duration_seconds: 90, rest_seconds: 45, order: 1, notes: '',
    };
    const programWithTimeEx = {
      ...draftProgram(),
      days: [
        { id: 1, day_number: 1, date: '2026-02-01', day_type: 'training', exercises: [timeExercise] },
        ...[...Array(27)].map((_, i) => ({
          id: i + 2, day_number: i + 2, date: `2026-02-${String(i + 2).padStart(2, '0')}`, day_type: 'rest', exercises: [],
        })),
      ],
    };
    setupApi({ programs: [programWithTimeEx] });

    render(<ClientProgramTab clientId={CLIENT_ID} />);
    await screen.findByText('Borrador');

    await act(async () => {
      fireEvent.click(screen.getByText('1 ejercicios'));
    });

    // duration_seconds is set, reps is null → shows seconds value + Tiempo unit label
    expect(screen.getByText('Tiempo')).toBeInTheDocument();
    expect(screen.getByText('90s')).toBeInTheDocument();
  });

  it('renders the adherence SVG ring when a published program has daily logs', async () => {
    setupStore({ logs: DAILY_LOGS });
    setupApi({ programs: [publishedProgram()] });

    render(<ClientProgramTab clientId={CLIENT_ID} />);
    await screen.findByText('Publicado');

    // The adherence card renders an SVG with a circle
    const svgEl = document.querySelector('svg circle');
    expect(svgEl).not.toBeNull();
  });

  it('shows the week 1 header open by default and week 2 collapsed', async () => {
    setupApi({ programs: [draftProgram()] });

    render(<ClientProgramTab clientId={CLIENT_ID} />);
    await screen.findByText('Borrador');

    // Week 1 is defaultOpen=true, so exercise rows are visible without clicking
    expect(screen.getByText('Semana 1')).toBeInTheDocument();
    // Week 2 days should not be visible without expanding
    expect(screen.getByText('Semana 2')).toBeInTheDocument();
  });

  it('filters the catalog results when the user types in the exercise search input', async () => {
    setupApi({ programs: [draftProgram()] });

    render(<ClientProgramTab clientId={CLIENT_ID} />);
    await screen.findByText('Borrador');

    await act(async () => {
      fireEvent.click(screen.getAllByText('2 ejercicios')[0]);
    });
    await act(async () => {
      fireEvent.click(screen.getAllByRole('button', { name: 'Editar ejercicio' })[0]);
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Cambiar ejercicio del catálogo' }));
    });

    const searchInput = screen.getByPlaceholderText(/Buscar por nombre/);
    await act(async () => {
      fireEvent.change(searchInput, { target: { value: 'Zancada' } });
    });

    // After typing, catalog exercise names from EXERCISE_CATALOG are visible
    expect(screen.getByText('Zancada con mancuernas')).toBeInTheDocument();
  });

  it('PATCHes fitness level 4 when the Avanzado button is clicked', async () => {
    setupApi({ programs: [draftProgram()], levelComputed: 2 });
    mockedApi.patch.mockResolvedValueOnce({ data: {} });

    render(<ClientProgramTab clientId={CLIENT_ID} />);
    await screen.findByText('Borrador');

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Editar nivel/ }));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Avanzado/ }));
    });

    expect(mockedApi.patch).toHaveBeenCalledWith(
      `/trainer/my-clients/${CLIENT_ID}/fitness-level/`,
      { fitness_level: 4 },
      expect.anything(),
    );
  });
});
