import { render, screen, fireEvent } from '@testing-library/react';
import ExerciseCard from '@/app/components/program/ExerciseCard';
import type { ProgramExercise, ExerciseLog } from '@/lib/stores/programStore';

jest.mock('@/app/components/program/YouTubeEmbed', () => ({
  __esModule: true,
  default: ({ title }: { title: string }) => <div data-testid="youtube-embed">{title}</div>,
}));

function makeProgramExercise(overrides: Partial<ProgramExercise> = {}): ProgramExercise {
  return {
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
    ...overrides,
  };
}

function makeExerciseLog(overrides: Partial<ExerciseLog> = {}): ExerciseLog {
  return {
    id: 100,
    program_exercise: makeProgramExercise(),
    status: 'not_done',
    notes: '',
    ...overrides,
  };
}

describe('ExerciseCard', () => {
  it('renders the exercise name', () => {
    render(<ExerciseCard programExercise={makeProgramExercise()} />);

    expect(screen.getByText('Sentadilla')).toBeInTheDocument();
  });

  it('renders the movement pattern chip', () => {
    render(<ExerciseCard programExercise={makeProgramExercise()} />);

    expect(screen.getByText('Fuerza')).toBeInTheDocument();
  });

  it('renders a sets by reps label when reps are defined', () => {
    render(<ExerciseCard programExercise={makeProgramExercise({ sets: 3, reps: 10 })} />);

    expect(screen.getByText(/3 × 10 reps/)).toBeInTheDocument();
  });

  it('renders a sets by duration label when reps are null', () => {
    render(
      <ExerciseCard
        programExercise={makeProgramExercise({ sets: 4, reps: null, duration_seconds: 30 })}
      />,
    );

    expect(screen.getByText(/4 × 30s/)).toBeInTheDocument();
  });

  it('renders the corrective badge when the exercise is corrective', () => {
    const pe = makeProgramExercise({
      exercise: { ...makeProgramExercise().exercise, is_corrective: true },
    });
    render(<ExerciseCard programExercise={pe} />);

    expect(screen.getByText('Correctivo')).toBeInTheDocument();
  });

  it('omits the corrective badge when the exercise is not corrective', () => {
    render(<ExerciseCard programExercise={makeProgramExercise()} />);

    expect(screen.queryByText('Correctivo')).not.toBeInTheDocument();
  });

  it('omits the video toggle when the exercise has no youtube url', () => {
    render(<ExerciseCard programExercise={makeProgramExercise()} />);

    expect(screen.queryByRole('button', { name: 'Ver video' })).not.toBeInTheDocument();
  });

  it('reveals the video embed when the video toggle is clicked', () => {
    const pe = makeProgramExercise({
      exercise: { ...makeProgramExercise().exercise, youtube_url: 'https://youtu.be/abc' },
    });
    render(<ExerciseCard programExercise={pe} />);

    fireEvent.click(screen.getByRole('button', { name: 'Ver video' }));

    expect(screen.getByTestId('youtube-embed')).toBeInTheDocument();
  });

  it('renders the status buttons when a log is open with a status handler', () => {
    render(
      <ExerciseCard
        programExercise={makeProgramExercise()}
        exerciseLog={makeExerciseLog()}
        onStatusChange={jest.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: /Completado/ })).toBeInTheDocument();
  });

  it('calls onStatusChange with completed when the complete button is clicked', () => {
    const onStatusChange = jest.fn();
    render(
      <ExerciseCard
        programExercise={makeProgramExercise()}
        exerciseLog={makeExerciseLog({ id: 100 })}
        onStatusChange={onStatusChange}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Completado/ }));

    expect(onStatusChange).toHaveBeenCalledWith(100, 'completed');
  });

  it('calls onStatusChange with skipped when the skip button is clicked', () => {
    const onStatusChange = jest.fn();
    render(
      <ExerciseCard
        programExercise={makeProgramExercise()}
        exerciseLog={makeExerciseLog({ id: 100 })}
        onStatusChange={onStatusChange}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Omitir' }));

    expect(onStatusChange).toHaveBeenCalledWith(100, 'skipped');
  });

  it('shows a closed-log notice when the log is closed', () => {
    render(
      <ExerciseCard
        programExercise={makeProgramExercise()}
        exerciseLog={makeExerciseLog()}
        onStatusChange={jest.fn()}
        logClosed
      />,
    );

    expect(screen.getByText('Registro cerrado')).toBeInTheDocument();
  });

  it('hides the status buttons when the log is closed', () => {
    render(
      <ExerciseCard
        programExercise={makeProgramExercise()}
        exerciseLog={makeExerciseLog()}
        onStatusChange={jest.fn()}
        logClosed
      />,
    );

    expect(screen.queryByRole('button', { name: /Completado/ })).not.toBeInTheDocument();
  });
});
