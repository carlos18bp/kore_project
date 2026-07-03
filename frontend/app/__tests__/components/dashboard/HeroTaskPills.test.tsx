import { render, screen } from '@testing-library/react';

jest.mock('js-cookie', () => ({ get: jest.fn(() => 'tok'), set: jest.fn(), remove: jest.fn() }));
jest.mock('@/lib/services/http', () => ({
  api: { get: jest.fn().mockResolvedValue({ data: null }), post: jest.fn(), patch: jest.fn(), delete: jest.fn() },
  getWithRetry: jest.fn(), extractApiError: jest.fn(),
}));

import { useProfileStore } from '@/lib/stores/profileStore';
import { useNutritionDailyStore } from '@/lib/stores/nutritionDailyStore';
import { useProgramStore } from '@/lib/stores/programStore';
import { useCreditValuesStore } from '@/lib/stores/creditValuesStore';
import HeroTaskPills from '@/app/components/dashboard/HeroTaskPills';

describe('HeroTaskPills', () => {
  beforeEach(() => {
    useProfileStore.setState({ todayMood: { score: 8, notes: '', date: 'x' }, openMoodModal: () => {} } as never);
    useNutritionDailyStore.setState({
      todayLog: { id: 1, date: 'x', is_closed: false, water_glasses: [{}, {}], meal_entries: [{ id: 1, status: 'completed', photo_url: 'a.jpg' }] },
      fetchTodayLog: async () => {},
    } as never);
    useProgramStore.setState({
      todayData: { program_day: {}, daily_log: { id: 1, exercise_logs: [{ id: 1, status: 'completed' }, { id: 2, status: 'not_done' }] } },
      fetchTodayData: async () => {},
    } as never);
    useCreditValuesStore.setState({
      actionValues: { checkin: 5, water_goal: 10, meal_photo: 5, workout_day: 15 },
      waterGoalGlasses: 8, loaded: true, fetchValues: async () => {},
    } as never);
  });

  it('renders the four task pills with dynamic chips', () => {
    render(<HeroTaskPills />);
    expect(screen.getByTestId('hero-task-pills')).toBeInTheDocument();
    expect(screen.getByText('Check-in')).toBeInTheDocument();
    expect(screen.getByText('Hidratación')).toBeInTheDocument();
    expect(screen.getByText('Comidas')).toBeInTheDocument();
    expect(screen.getByText('Rutina')).toBeInTheDocument();
    expect(screen.getByText('+15')).toBeInTheDocument();
  });
});
