import { render, screen, act, fireEvent } from '@testing-library/react';
import ProgressTabsCard from '@/app/components/program/ProgressTabsCard';
import { useProgressStore } from '@/lib/stores/progressStore';

jest.mock('@/lib/stores/progressStore', () => ({ useProgressStore: jest.fn() }));

const mStore = useProgressStore as unknown as jest.Mock;

const WEEKLY = {
  week_number: 2,
  week_average: 0.73,
  streak: { current: 3, longest: 5, start_date: '2026-02-01' },
  days: [
    { date: '2026-02-09', day_type: 'training', is_future: false, training_adherence: 1, nutrition_adherence: 0.8, combined_adherence: 0.9, exercises_completed: 5, exercises_total: 5, meals_completed: 4, meals_total: 5 },
    { date: '2026-02-10', day_type: 'rest', is_future: false, training_adherence: 0, nutrition_adherence: 1, combined_adherence: 0.5, exercises_completed: 0, exercises_total: 0, meals_completed: 5, meals_total: 5 },
    { date: '2026-02-11', day_type: 'training', is_future: true, training_adherence: 0, nutrition_adherence: 0, combined_adherence: 0, exercises_completed: 0, exercises_total: 4, meals_completed: 0, meals_total: 5 },
  ],
};

const PROJECTION = {
  projected_final_adherence: 0.82,
  weight_projection: 78,
  trend: 'improving' as const,
  confidence: 'high' as const,
  recommendation: 'Mantén el ritmo de entrenamiento.',
  days_elapsed: 10,
  days_remaining: 18,
};

const MONTHLY = {
  program_id: 1,
  start_date: '2026-02-01',
  end_date: '2026-02-28',
  overall_adherence: 0.8,
  training_adherence: 0.85,
  nutrition_adherence: 0.7,
  comparisons: {
    bmi: { before: 26.0, after: 25.2, delta: -0.8 },
    body_fat_pct: { before: 22.0, after: 20.0, delta: -2.0 },
    physical_index: { before: 3.0, after: 3.5, delta: 0.5 },
  },
  mood: { first_week: 6, last_week: 7 },
  weight: { start: 80, end: 78, delta: -2 },
  streak_best: 7,
};

function setupStore(opts: {
  weekly?: unknown | null; weeklyLoading?: boolean;
  monthly?: unknown | null; monthlyLoading?: boolean;
  projection?: unknown | null;
} = {}) {
  mStore.mockReturnValue({
    weeklySummary: opts.weekly === undefined ? WEEKLY : opts.weekly,
    weeklyLoading: opts.weeklyLoading ?? false,
    monthlySummary: opts.monthly === undefined ? MONTHLY : opts.monthly,
    monthlyLoading: opts.monthlyLoading ?? false,
    projection: opts.projection === undefined ? PROJECTION : opts.projection,
    fetchWeeklySummary: jest.fn(),
    fetchMonthlySummary: jest.fn(),
    fetchProjection: jest.fn(),
  });
}

describe('ProgressTabsCard', () => {
  beforeEach(() => jest.clearAllMocks());

  it('shows the weekly combined adherence percentage', () => {
    setupStore();

    render(<ProgressTabsCard />);

    expect(screen.getByText('73')).toBeInTheDocument();
    expect(screen.getByText('Adherencia combinada')).toBeInTheDocument();
  });

  it('renders both bottom tab buttons', () => {
    setupStore();

    render(<ProgressTabsCard />);

    expect(screen.getByRole('button', { name: 'Mi Progreso' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Resumen Mensual' })).toBeInTheDocument();
  });

  it('switches to the monthly summary content when the Resumen tab is clicked', () => {
    setupStore();

    render(<ProgressTabsCard />);
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Resumen Mensual' }));
    });

    expect(screen.getByText('Adherencia total')).toBeInTheDocument();
  });

  it('renders the daily distribution chart legend in the weekly view', () => {
    setupStore();

    render(<ProgressTabsCard />);

    expect(screen.getByText('Distribución diaria')).toBeInTheDocument();
  });

  it('renders the monthly ring label in the summary view', () => {
    setupStore();

    render(<ProgressTabsCard />);
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Resumen Mensual' }));
    });

    expect(screen.getByText('COMBINADA')).toBeInTheDocument();
  });

  it('renders the projection widget when projection data is available', () => {
    setupStore();

    render(<ProgressTabsCard />);

    expect(screen.getByText('Si mantienes el ritmo')).toBeInTheDocument();
    expect(screen.getByText('Mantén el ritmo de entrenamiento.')).toBeInTheDocument();
  });

  it('calls onToggleMobile when the mobile detail toggle is clicked', () => {
    setupStore();
    const onToggleMobile = jest.fn();

    render(<ProgressTabsCard onToggleMobile={onToggleMobile} />);
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: /Ver detalle/ }));
    });

    expect(onToggleMobile).toHaveBeenCalledTimes(1);
  });

  it('shows the empty state when there is no weekly data', () => {
    setupStore({ weekly: null });

    render(<ProgressTabsCard />);

    expect(screen.getByText('No hay datos de progreso todavía.')).toBeInTheDocument();
  });
});
