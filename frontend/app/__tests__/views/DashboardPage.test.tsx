import React from 'react';
import { render, screen } from '@testing-library/react';
import DashboardPage from '@/app/(app)/dashboard/page';
import { useAuthStore } from '@/lib/stores/authStore';

const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

jest.mock('js-cookie', () => ({
  get: jest.fn(),
  set: jest.fn(),
  remove: jest.fn(),
}));

jest.mock('gsap', () => ({
  __esModule: true,
  default: { set: jest.fn(), to: jest.fn(), timeline: jest.fn(() => ({ to: jest.fn().mockReturnThis() })), context: jest.fn(() => ({ revert: jest.fn() })) },
}));

jest.mock('next/image', () => ({
  __esModule: true,
  default: (props: React.ImgHTMLAttributes<HTMLImageElement>) => <img {...props} />,
}));

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href, ...rest }: { children: React.ReactNode; href: string }) => (
    <a href={href} {...rest}>{children}</a>
  ),
}));

jest.mock('@/app/composables/useScrollAnimations', () => ({
  useHeroAnimation: jest.fn(),
}));

jest.mock('@/lib/stores/bookingStore', () => ({
  useBookingStore: () => ({
    upcomingReminder: null,
    bookings: [],
    fetchUpcomingReminder: jest.fn(),
    fetchBookings: jest.fn(),
  }),
}));

jest.mock('@/lib/stores/subscriptionStore', () => ({
  useSubscriptionStore: () => ({
    activeSubscription: null,
    fetchSubscriptions: jest.fn(),
  }),
}));

jest.mock('@/lib/stores/profileStore', () => ({
  useProfileStore: () => ({
    profile: null,
    todayMood: null,
    fetchProfile: jest.fn(),
    openMoodModal: jest.fn(),
  }),
}));

jest.mock('@/lib/stores/creditValuesStore', () => ({
  useCreditValuesStore: () => ({
    actionValues: {},
    streakBonuses: {},
    waterGoalGlasses: 8,
    requireWorkoutCaptures: false,
    loaded: false,
    fetchValues: jest.fn(),
    value: () => null,
  }),
}));

jest.mock('@/lib/stores/anthropometryStore', () => ({
  useAnthropometryStore: () => ({
    evaluations: [],
    fetchMyEvaluations: jest.fn(),
  }),
}));

jest.mock('@/lib/stores/posturometryStore', () => ({
  usePosturometryStore: () => ({
    evaluations: [],
    fetchMyEvaluations: jest.fn(),
  }),
}));

jest.mock('@/lib/stores/physicalEvaluationStore', () => ({
  usePhysicalEvaluationStore: () => ({
    evaluations: [],
    fetchMyEvaluations: jest.fn(),
  }),
}));

jest.mock('@/lib/stores/nutritionStore', () => ({
  useNutritionStore: () => ({
    entries: [],
    fetchMyEntries: jest.fn(),
  }),
}));

jest.mock('@/lib/stores/parqStore', () => ({
  useParqStore: () => ({
    assessments: [],
    fetchMyAssessments: jest.fn(),
  }),
}));

jest.mock('@/lib/stores/pendingAssessmentsStore', () => ({
  usePendingAssessmentsStore: () => ({
    koreIndex: null,
    fetchPending: jest.fn(),
    loaded: false,
  }),
}));

jest.mock('@/app/components/booking/UpcomingSessionReminder', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('@/app/components/subscription/SubscriptionExpiryReminder', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('@/app/components/subscription/SubscriptionDashboardToast', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('@/lib/stores/nutritionDailyStore', () => ({
  useNutritionDailyStore: () => ({
    todayLog: null,
    fetchTodayLog: jest.fn(),
  }),
}));

jest.mock('@/lib/stores/programStore', () => ({
  useProgramStore: () => ({
    activeProgram: null,
    fetchActiveProgram: jest.fn(),
    todayData: null,
    fetchTodayData: jest.fn(),
  }),
}));

jest.mock('@/lib/stores/progressStore', () => ({
  useProgressStore: () => ({
    weeklySummary: null,
    fetchWeeklySummary: jest.fn(),
  }),
}));

jest.mock('@/app/components/program/ProgressTabsCard', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('@/app/components/booking/UpcomingSessionsCard', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('@/app/components/dashboard/TrainerMessageBanner', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('@/lib/services/http', () => ({
  api: { get: jest.fn().mockRejectedValue(new Error('no subs')), post: jest.fn() },
}));

const mockUser = {
  id: '22',
  email: 'customer10@kore.com',
  first_name: 'Customer10',
  last_name: 'Kore',
  phone: '',
  role: 'customer',
  name: 'Customer10 Kore',
  profile_completed: false,
  avatar_url: '',
};

describe('DashboardPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders loading spinner when user is null', () => {
    useAuthStore.setState({ user: null, isAuthenticated: false, accessToken: null });
    render(<DashboardPage />);
    expect(screen.getByRole('status', { name: 'Cargando' })).toBeInTheDocument();
  });

  it('renders greeting with first name when user is present', () => {
    useAuthStore.setState({ user: mockUser, isAuthenticated: true, accessToken: 'token' });
    render(<DashboardPage />);
    expect(screen.getAllByText(/Customer10/).length).toBeGreaterThanOrEqual(1);
  });

  it('renders Tu espacio section header', () => {
    useAuthStore.setState({ user: mockUser, isAuthenticated: true, accessToken: 'token' });
    render(<DashboardPage />);
    expect(screen.getAllByText('Tu espacio').length).toBeGreaterThanOrEqual(1);
  });

  it('renders upcoming sessions section header', () => {
    useAuthStore.setState({ user: mockUser, isAuthenticated: true, accessToken: 'token' });
    render(<DashboardPage />);
    expect(screen.getAllByText('Próximas sesiones').length).toBeGreaterThanOrEqual(1);
  });

  it('renders greeting with user first name and header', () => {
    useAuthStore.setState({ user: mockUser, isAuthenticated: true, accessToken: 'token' });
    render(<DashboardPage />);
    expect(screen.getAllByText(/Customer10/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Tu espacio').length).toBeGreaterThanOrEqual(1);
  });
});
