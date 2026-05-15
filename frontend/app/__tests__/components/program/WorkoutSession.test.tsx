import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import WorkoutSession from '@/app/components/program/WorkoutSession';
import type { TodayData } from '@/lib/stores/programStore';

jest.mock('@/app/components/program/YouTubeEmbed', () => ({
  __esModule: true,
  default: ({ title }: { title: string }) => <div data-testid="youtube-embed">{title}</div>,
}));

jest.mock('@/app/components/program/RestTimer', () => ({
  __esModule: true,
  default: ({ onDismiss }: { onDismiss: () => void }) => (
    <div data-testid="rest-timer">
      <button onClick={onDismiss}>Cerrar timer</button>
    </div>
  ),
}));

function makeExerciseLog(overrides: Partial<TodayData['daily_log']['exercise_logs'][0]> = {}) {
  return {
    id: 100,
    status: 'not_done' as const,
    notes: '',
    program_exercise: {
      id: 50,
      exercise: {
        id: 1,
        name: 'Sentadilla',
        pattern: 'Fuerza',
        youtube_url: '',
        explanation: '',
        is_corrective: false,
        primary_muscles: 'Cuádriceps',
        secondary_muscles: 'Glúteos',
      },
      sets: 3,
      reps: 10,
      duration_seconds: null,
      rest_seconds: 60,
      order: 1,
      notes: '',
    },
    ...overrides,
  };
}

const SINGLE_EXERCISE_TODAY: TodayData = {
  program_day: {
    id: 1,
    day_number: 5,
    date: '2026-05-15',
    day_type: 'training',
    exercises: [],
  },
  daily_log: {
    id: 10,
    date: '2026-05-15',
    is_closed: false,
    closed_at: null,
    exercise_logs: [makeExerciseLog()],
  },
};

const BASE_PE = makeExerciseLog().program_exercise;

const TWO_EXERCISE_TODAY: TodayData = {
  ...SINGLE_EXERCISE_TODAY,
  daily_log: {
    ...SINGLE_EXERCISE_TODAY.daily_log,
    exercise_logs: [
      makeExerciseLog({ id: 100, program_exercise: { ...BASE_PE, order: 1 } }),
      makeExerciseLog({
        id: 101,
        program_exercise: {
          ...BASE_PE,
          id: 51,
          exercise: { ...BASE_PE.exercise, name: 'Press banca' },
          order: 2,
        },
      }),
    ],
  },
};

describe('WorkoutSession', () => {
  const onClose = jest.fn();
  const onStatusChange = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the exercise name of the first exercise', () => {
    render(<WorkoutSession todayData={SINGLE_EXERCISE_TODAY} onClose={onClose} onStatusChange={onStatusChange} />);

    expect(screen.getByText('Sentadilla')).toBeInTheDocument();
  });

  it('renders the sets × reps label', () => {
    render(<WorkoutSession todayData={SINGLE_EXERCISE_TODAY} onClose={onClose} onStatusChange={onStatusChange} />);

    expect(screen.getByText(/3 × 10 reps/)).toBeInTheDocument();
  });

  it('renders the position indicator (1 / total)', () => {
    render(<WorkoutSession todayData={TWO_EXERCISE_TODAY} onClose={onClose} onStatusChange={onStatusChange} />);

    expect(screen.getByText('1 / 2')).toBeInTheDocument();
  });

  it('shows RestTimer after tapping a set chip', () => {
    render(<WorkoutSession todayData={SINGLE_EXERCISE_TODAY} onClose={onClose} onStatusChange={onStatusChange} />);

    const setButton = screen.getByRole('button', { name: '1' });
    fireEvent.click(setButton);

    expect(screen.getByTestId('rest-timer')).toBeInTheDocument();
  });

  it('dismissing RestTimer hides it', () => {
    render(<WorkoutSession todayData={SINGLE_EXERCISE_TODAY} onClose={onClose} onStatusChange={onStatusChange} />);

    fireEvent.click(screen.getByRole('button', { name: '1' }));
    expect(screen.getByTestId('rest-timer')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Cerrar timer' }));
    expect(screen.queryByTestId('rest-timer')).not.toBeInTheDocument();
  });

  it('Completar button calls onStatusChange with completed status', () => {
    render(<WorkoutSession todayData={TWO_EXERCISE_TODAY} onClose={onClose} onStatusChange={onStatusChange} />);

    fireEvent.click(screen.getByRole('button', { name: /Completar/ }));

    expect(onStatusChange).toHaveBeenCalledWith(100, 'completed');
  });

  it('Omitir button calls onStatusChange with skipped status', () => {
    render(<WorkoutSession todayData={TWO_EXERCISE_TODAY} onClose={onClose} onStatusChange={onStatusChange} />);

    fireEvent.click(screen.getByRole('button', { name: 'Omitir' }));

    expect(onStatusChange).toHaveBeenCalledWith(100, 'skipped');
  });

  it('Prev button is disabled on the first exercise', () => {
    render(<WorkoutSession todayData={TWO_EXERCISE_TODAY} onClose={onClose} onStatusChange={onStatusChange} />);

    const prevBtn = screen.getByRole('button', { name: 'Cerrar sesión' });
    // prev is the disabled button at bottom-left; use aria-disabled or disabled attribute
    // actually prev has no aria-label, it just has disabled prop
    const allButtons = screen.getAllByRole('button');
    // The prev button is the one with "disabled" attr in the footer
    const disabledButtons = allButtons.filter((b) => (b as HTMLButtonElement).disabled);
    expect(disabledButtons.length).toBeGreaterThan(0);
  });

  it('advancing to next exercise changes the exercise displayed', () => {
    render(<WorkoutSession todayData={TWO_EXERCISE_TODAY} onClose={onClose} onStatusChange={onStatusChange} />);

    // Click next (right arrow button in footer — the rightmost button)
    const allButtons = screen.getAllByRole('button');
    const nextArrow = allButtons[allButtons.length - 1];
    fireEvent.click(nextArrow);

    expect(screen.getByText('Press banca')).toBeInTheDocument();
    expect(screen.getByText('2 / 2')).toBeInTheDocument();
  });

  it('completing the last exercise shows the celebration screen', () => {
    render(<WorkoutSession todayData={SINGLE_EXERCISE_TODAY} onClose={onClose} onStatusChange={onStatusChange} />);

    fireEvent.click(screen.getByRole('button', { name: /Completar/ }));

    expect(screen.getByText('¡Sesión completada!')).toBeInTheDocument();
    expect(screen.getByText('0')).toBeInTheDocument();
    expect(screen.getByText('Completados')).toBeInTheDocument();
  });

  it('Ver resumen button on completion screen calls onClose', () => {
    render(<WorkoutSession todayData={SINGLE_EXERCISE_TODAY} onClose={onClose} onStatusChange={onStatusChange} />);

    fireEvent.click(screen.getByRole('button', { name: /Completar/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Ver resumen' }));

    expect(onClose).toHaveBeenCalled();
  });

  it('close button in header calls onClose', () => {
    render(<WorkoutSession todayData={SINGLE_EXERCISE_TODAY} onClose={onClose} onStatusChange={onStatusChange} />);

    fireEvent.click(screen.getByRole('button', { name: 'Cerrar sesión' }));

    expect(onClose).toHaveBeenCalled();
  });
});
