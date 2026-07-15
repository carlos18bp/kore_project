import { render, screen } from '@testing-library/react';
import TrainerEngagementView from '@/app/components/trainer/TrainerEngagementView';
import { useTrainerEngagementStore } from '@/lib/stores/trainerEngagementStore';

jest.mock('@/lib/stores/trainerEngagementStore', () => ({
  useTrainerEngagementStore: jest.fn(),
}));

// RatingsSummaryCard fetches on its own — stub it out.
jest.mock('@/app/components/trainer/RatingsSummaryCard', () => ({
  __esModule: true,
  default: () => <div data-testid="ratings-card" />,
}));

const mocked = useTrainerEngagementStore as unknown as jest.Mock;

const DATA = {
  summary: {
    clients_total: 2, active_streaks: 1, checked_in_today: 1, checked_in_today_pct: 50,
    credits_earned_30d: 30, credits_spent_30d: 10, attendance_rate_30d: 50,
  },
  roster: [
    { customer_id: 1, name: 'Ana García', current_streak: 7, last_checkin: '2026-07-15', attendance_rate_30d: 100, average_rating: 5 },
  ],
};

it('renders summary tiles and a roster row', () => {
  mocked.mockReturnValue({ data: DATA, loading: false, error: null, fetchEngagement: jest.fn() });
  render(<TrainerEngagementView />);
  expect(screen.getByText('Rachas activas')).toBeInTheDocument();
  expect(screen.getByText('Ana García')).toBeInTheDocument();
});

it('renders an empty state when there are no clients', () => {
  mocked.mockReturnValue({
    data: { summary: { ...DATA.summary, clients_total: 0 }, roster: [] },
    loading: false, error: null, fetchEngagement: jest.fn(),
  });
  render(<TrainerEngagementView />);
  expect(screen.getByText(/Sin clientes/i)).toBeInTheDocument();
});
