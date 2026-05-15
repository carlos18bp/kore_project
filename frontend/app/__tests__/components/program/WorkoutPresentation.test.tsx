import { render, screen, act, fireEvent } from '@testing-library/react';
import WorkoutPresentation from '@/app/components/program/WorkoutPresentation';

// Local GSAP override: a chainable timeline whose `call(fn)` runs `fn` synchronously,
// so the countdown phase advances to "execute" without real timers.
jest.mock('gsap', () => {
  const makeTimeline = () => {
    const tl: Record<string, unknown> = {};
    tl.fromTo = jest.fn(() => tl);
    tl.to = jest.fn(() => tl);
    tl.from = jest.fn(() => tl);
    tl.set = jest.fn(() => tl);
    tl.call = jest.fn((fn: () => void) => { if (typeof fn === 'function') fn(); return tl; });
    tl.kill = jest.fn();
    return tl;
  };
  const gsapMock = {
    registerPlugin: jest.fn(),
    context: jest.fn((fn: unknown) => { if (typeof fn === 'function') (fn as () => void)(); return { revert: jest.fn() }; }),
    set: jest.fn(),
    to: jest.fn(),
    from: jest.fn(),
    fromTo: jest.fn(),
    timeline: jest.fn(() => makeTimeline()),
  };
  return { __esModule: true, default: gsapMock, gsap: gsapMock };
});

jest.mock('@/app/components/program/YouTubeEmbed', () => ({
  __esModule: true,
  default: ({ title }: { title: string }) => <div data-testid="youtube-embed">{title}</div>,
}));

function makeExerciseLog(id: number, name: string, opts: { reps?: number | null; sets?: number; youtube?: string; duration_seconds?: number | null } = {}) {
  return {
    id,
    status: 'not_done' as const,
    notes: '',
    program_exercise: {
      id: id * 10,
      exercise: {
        id: id * 100, name, pattern: 'squat', youtube_url: opts.youtube ?? '',
        explanation: '', is_corrective: false, primary_muscles: 'quads, glutes', secondary_muscles: '',
      },
      sets: opts.sets ?? 1,
      reps: opts.reps === undefined ? 12 : opts.reps,
      duration_seconds: opts.duration_seconds ?? null,
      rest_seconds: 60,
      order: id,
      notes: '',
    },
  };
}

function makeTodayData(logs: unknown[]) {
  return {
    program_day: { id: 1, day_number: 1, date: '2026-03-01', day_type: 'training' as const, exercises: [] },
    daily_log: { id: 1, date: '2026-03-01', is_closed: false, closed_at: null, exercise_logs: logs },
  };
}

function renderWorkout(opts: { logs?: unknown[]; onClose?: jest.Mock; onStatusChange?: jest.Mock } = {}) {
  const onClose = opts.onClose ?? jest.fn();
  const onStatusChange = opts.onStatusChange ?? jest.fn();
  const logs = opts.logs ?? [
    makeExerciseLog(1, 'Sentadilla búlgara', { youtube: 'https://youtu.be/abc123' }),
    makeExerciseLog(2, 'Press de banca'),
  ];
  render(<WorkoutPresentation todayData={makeTodayData(logs)} onClose={onClose} onStatusChange={onStatusChange} />);
  return { onClose, onStatusChange };
}

describe('WorkoutPresentation', () => {
  beforeEach(() => jest.clearAllMocks());

  it('renders the intro phase with the first exercise name', () => {
    renderWorkout();

    expect(screen.getByRole('heading', { name: 'Sentadilla búlgara' })).toBeInTheDocument();
  });

  it('advances to the next exercise when the current one is skipped', () => {
    renderWorkout();
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Omitir ejercicio' }));
    });

    expect(screen.getByRole('heading', { name: 'Press de banca' })).toBeInTheDocument();
  });

  it('calls onStatusChange with the skipped status when skipping an exercise', () => {
    const { onStatusChange } = renderWorkout();
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Omitir ejercicio' }));
    });

    expect(onStatusChange).toHaveBeenCalledWith(1, 'skipped');
  });

  it('calls onStatusChange with the completed status after finishing the only set', () => {
    const { onStatusChange } = renderWorkout({ logs: [makeExerciseLog(1, 'Sentadilla')] });
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: /vamos/ }));
    });
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: /Completé el set/ }));
    });

    expect(onStatusChange).toHaveBeenCalledWith(1, 'completed');
  });

  it('calls onClose when the close button is clicked', () => {
    const { onClose } = renderWorkout();
    act(() => {
      fireEvent.click(screen.getAllByRole('button')[0]);
    });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('renders the YouTube embed when the exercise has a video URL', () => {
    renderWorkout();

    expect(screen.getByTestId('youtube-embed')).toBeInTheDocument();
  });

  it('does not render the youtube-embed when the exercise has no video URL', () => {
    renderWorkout({ logs: [makeExerciseLog(1, 'Sentadilla', { youtube: '' })] });

    expect(screen.queryByTestId('youtube-embed')).not.toBeInTheDocument();
  });

  it('shows rest phase after completing the first of two sets', () => {
    renderWorkout({ logs: [makeExerciseLog(1, 'Sentadilla', { sets: 2 })] });

    act(() => { fireEvent.click(screen.getByRole('button', { name: /vamos/i })); });
    act(() => { fireEvent.click(screen.getByRole('button', { name: /Completé el set/ })); });

    expect(screen.getByText(/descansa/i)).toBeInTheDocument();
  });

  it('returns to execute phase when Listo, continuar is clicked in rest', () => {
    renderWorkout({ logs: [makeExerciseLog(1, 'Sentadilla', { sets: 2 })] });

    act(() => { fireEvent.click(screen.getByRole('button', { name: /vamos/i })); });
    act(() => { fireEvent.click(screen.getByRole('button', { name: /Completé el set/ })); });
    act(() => { fireEvent.click(screen.getByRole('button', { name: 'Listo, continuar' })); });

    expect(screen.getByRole('button', { name: /Completé el set/ })).toBeInTheDocument();
  });

  it('calls onStatusChange with completed after finishing all sets on a multi-set exercise', () => {
    const { onStatusChange } = renderWorkout({ logs: [makeExerciseLog(1, 'Sentadilla', { sets: 2 })] });

    act(() => { fireEvent.click(screen.getByRole('button', { name: /vamos/i })); });
    act(() => { fireEvent.click(screen.getByRole('button', { name: /Completé el set/ })); });
    act(() => { fireEvent.click(screen.getByRole('button', { name: 'Listo, continuar' })); });
    act(() => { fireEvent.click(screen.getByRole('button', { name: /Completé el set/ })); });

    expect(onStatusChange).toHaveBeenCalledWith(1, 'completed');
  });

  it('shows the complete screen after finishing the last exercise', () => {
    renderWorkout({ logs: [makeExerciseLog(1, 'Sentadilla')] });

    act(() => { fireEvent.click(screen.getByRole('button', { name: /vamos/i })); });
    act(() => { fireEvent.click(screen.getByRole('button', { name: /Completé el set/ })); });

    expect(screen.getByRole('heading', { name: '¡Sesión completada!' })).toBeInTheDocument();
  });

  it('calls onClose when Ver resumen is clicked on the complete screen', () => {
    const { onClose } = renderWorkout({ logs: [makeExerciseLog(1, 'Sentadilla')] });

    act(() => { fireEvent.click(screen.getByRole('button', { name: /vamos/i })); });
    act(() => { fireEvent.click(screen.getByRole('button', { name: /Completé el set/ })); });
    act(() => { fireEvent.click(screen.getByRole('button', { name: 'Ver resumen' })); });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('renders timer display instead of rep count for a duration-based exercise in execute phase', () => {
    renderWorkout({ logs: [makeExerciseLog(1, 'Plank', { reps: null, duration_seconds: 30 })] });

    act(() => { fireEvent.click(screen.getByRole('button', { name: /vamos/i })); });

    expect(screen.queryByText('repeticiones')).not.toBeInTheDocument();
    // timer ring renders an SVG circle
    expect(document.querySelector('svg circle')).not.toBeNull();
  });

  it('shows Omitidos section on complete screen when initial data contains skipped exercises', () => {
    const skippedLog = { ...makeExerciseLog(1, 'Sentadilla'), status: 'skipped' as const };
    renderWorkout({ logs: [skippedLog] });

    act(() => { fireEvent.click(screen.getByRole('button', { name: 'Omitir ejercicio' })); });

    expect(screen.getByText('Omitidos')).toBeInTheDocument();
  });
});
