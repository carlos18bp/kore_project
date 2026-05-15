import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import EvalNutriTab from '@/app/components/trainer/evals/EvalNutriTab';
import { useNutritionStore } from '@/lib/stores/nutritionStore';
import type { NutritionHabit } from '@/lib/stores/nutritionStore';

jest.mock('@/lib/stores/nutritionStore', () => ({
  useNutritionStore: jest.fn(),
}));

jest.mock('@/app/components/trainer/evals/shared', () => ({
  T: { textDark: '#111', textSoft: '#888', borderSoft: '#eee', wine: '#5C2030', wineDeep: '#2D0F1A', wineDeep2: '#4A1828', ivory: '#FFF8EC', champagne: '#E7C8A0', sage: '#A8C29C', amber: '#E5C97A', sageDeep: '#7AA574', amberDeep: '#C6A234', petal: '#F4C7C7' },
  FormHero: ({ title, kicker }: { title: string; kicker?: string }) => (
    <div data-testid="form-hero">
      {kicker && <span>{kicker}</span>}
      <span>{title}</span>
    </div>
  ),
  FormSection: ({ title, children }: { title: string; children: React.ReactNode }) => (
    <div data-testid="form-section">
      <span>{title}</span>
      {children}
    </div>
  ),
  ComputedCard: ({ label }: { label: string }) => <div>{label}</div>,
  NotesField: ({ label }: { label: string }) => <div>{label}</div>,
  EvalEmptyState: ({ message }: { message: string }) => (
    <div data-testid="eval-empty-state">{message}</div>
  ),
  EvalSpinner: () => <div data-testid="eval-spinner">Cargando…</div>,
}));

const mockedUseNutritionStore = useNutritionStore as unknown as jest.Mock;

const MOCK_HABIT: NutritionHabit = {
  id: 5,
  customer_id: 10,
  meals_per_day: 4,
  water_liters: '2.5',
  fruit_weekly: 10,
  vegetable_weekly: 12,
  protein_frequency: 4,
  ultraprocessed_weekly: 2,
  sugary_drinks_weekly: 1,
  eats_breakfast: true,
  notes: 'Evito el gluten',
  habit_score: '7.8',
  habit_category: 'Bueno',
  habit_color: 'green',
  trainer_notes: '',
  trainer_approved_at: null,
  created_at: '2026-04-20T10:00:00Z',
};

function setupStore(overrides: Partial<{
  entries: NutritionHabit[];
  loading: boolean;
  fetchClientEntries: jest.Mock;
  approveEntry: jest.Mock;
}> = {}) {
  const fetchClientEntries = jest.fn().mockResolvedValue(undefined);
  const approveEntry = jest.fn().mockResolvedValue(undefined);

  mockedUseNutritionStore.mockReturnValue({
    entries: [],
    loading: false,
    fetchClientEntries,
    approveEntry,
    ...overrides,
  });

  return { fetchClientEntries, approveEntry };
}

describe('EvalNutriTab', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    sessionStorage.clear();
  });

  it('shows spinner when loading is true', () => {
    setupStore({ loading: true });
    render(<EvalNutriTab clientId={10} />);

    expect(screen.getByTestId('eval-spinner')).toBeInTheDocument();
  });

  it('shows empty state when there are no entries', () => {
    setupStore({ entries: [] });
    render(<EvalNutriTab clientId={10} />);

    expect(screen.getByTestId('eval-empty-state')).toBeInTheDocument();
    expect(screen.getByText(/Sin evaluaciones/i)).toBeInTheDocument();
  });

  it('calls fetchClientEntries on mount with the clientId', () => {
    const { fetchClientEntries } = setupStore({ entries: [] });
    render(<EvalNutriTab clientId={10} />);

    expect(fetchClientEntries).toHaveBeenCalledWith(10);
  });

  it('renders HabitView section when an entry exists', () => {
    setupStore({ entries: [MOCK_HABIT] });
    render(<EvalNutriTab clientId={10} />);

    expect(screen.getByText('Hábito nutricional')).toBeInTheDocument();
  });

  it('renders ApprovalCard with "Pendiente de aprobación" badge when not yet approved', () => {
    setupStore({ entries: [MOCK_HABIT] });
    render(<EvalNutriTab clientId={10} />);

    expect(screen.getByText('Pendiente de aprobación')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Aprobar evaluación' })).toBeInTheDocument();
  });

  it('renders approved state when trainer_approved_at is set', () => {
    const approvedHabit: NutritionHabit = {
      ...MOCK_HABIT,
      trainer_approved_at: '2026-05-01T09:00:00Z',
    };
    setupStore({ entries: [approvedHabit] });
    render(<EvalNutriTab clientId={10} />);

    expect(screen.getByText(/Aprobado/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Aprobar evaluación' })).not.toBeInTheDocument();
  });

  it('calls approveEntry when the approve button is clicked', async () => {
    const { approveEntry } = setupStore({ entries: [MOCK_HABIT] });
    render(<EvalNutriTab clientId={10} />);

    const approveBtn = screen.getByRole('button', { name: 'Aprobar evaluación' });
    fireEvent.click(approveBtn);

    await waitFor(() => {
      expect(approveEntry).toHaveBeenCalledWith(10, MOCK_HABIT.id, '');
    });
  });

  it('renders habit labels like "Comidas al día"', () => {
    setupStore({ entries: [MOCK_HABIT] });
    render(<EvalNutriTab clientId={10} />);

    expect(screen.getByText('Comidas al día')).toBeInTheDocument();
  });
});
