import { render, screen } from '@testing-library/react';

jest.mock('js-cookie', () => ({ get: jest.fn(() => 'tok'), set: jest.fn(), remove: jest.fn() }));
jest.mock('@/lib/services/http', () => ({
  api: { get: jest.fn().mockResolvedValue({ data: null }), post: jest.fn(), patch: jest.fn(), delete: jest.fn(), put: jest.fn() },
  getWithRetry: jest.fn(),
  extractApiError: jest.fn((_e: unknown, fb: string) => fb),
}));

import { useProfileStore } from '@/lib/stores/profileStore';
import { useNutritionDailyStore } from '@/lib/stores/nutritionDailyStore';
import { useProgramStore } from '@/lib/stores/programStore';
import { useCreditValuesStore } from '@/lib/stores/creditValuesStore';
import TodayCreditsCard from '@/app/components/dashboard/TodayCreditsCard';

describe('TodayCreditsCard', () => {
  beforeEach(() => {
    useProfileStore.setState({ todayMood: { score: 8, notes: '', date: 'x' } } as never);
    useNutritionDailyStore.setState({
      todayLog: {
        id: 1, date: 'x', is_closed: false,
        water_glasses: [{}, {}],
        meal_entries: [
          { id: 1, status: 'completed', photo_url: 'a.jpg' },
          { id: 2, status: 'not_done', photo_url: null },
        ],
      },
      fetchTodayLog: async () => {},
    } as never);
    useProgramStore.setState({
      todayData: { program_day: {}, daily_log: { id: 1, exercise_logs: [
        { id: 1, status: 'completed' }, { id: 2, status: 'not_done' },
      ] } },
      fetchTodayData: async () => {},
    } as never);
    useCreditValuesStore.setState({
      actionValues: { checkin: 5, water_goal: 10, meal_photo: 5, workout_day: 15 },
      waterGoalGlasses: 8, loaded: true, fetchValues: async () => {},
    } as never);
  });

  it('renders the four rows with dynamic chips and states', () => {
    render(<TodayCreditsCard />);
    expect(screen.getByText('Hoy ganas')).toBeInTheDocument();
    expect(screen.getByText('Completado')).toBeInTheDocument();      // check-in done
    expect(screen.getByText('2/8 vasos')).toBeInTheDocument();
    expect(screen.getByText('1/5 registradas')).toBeInTheDocument();
    expect(screen.getByText('1/2 ejercicios')).toBeInTheDocument();
    expect(screen.getByText('+15')).toBeInTheDocument();             // workout chip
  });
});
