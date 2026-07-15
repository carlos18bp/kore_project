import { render, screen } from '@testing-library/react';
import ReportsPage from '@/app/admin-platform/reports/page';
import { useAdminReportsStore } from '@/lib/stores/adminReportsStore';

jest.mock('@/lib/stores/adminReportsStore', () => ({
  useAdminReportsStore: jest.fn(),
}));

// AdminShell → AdminSidebar/AdminTopbar read the router + auth store.
jest.mock('next/navigation', () => ({
  usePathname: () => '/admin-platform/reports',
  useRouter: () => ({ push: jest.fn() }),
}));

const mockUser = {
  id: '1',
  email: 'admin@example.com',
  first_name: 'Ana',
  last_name: 'García',
  phone: '',
  role: 'ADMIN',
  name: 'Ana García',
  profile_completed: true,
  avatar_url: null,
  must_change_password: false,
  assigned_trainer: null,
};

jest.mock('@/lib/stores/authStore', () => ({
  useAuthStore: (selector?: (state: { user: typeof mockUser; logout: () => void }) => unknown) => {
    const state = { user: mockUser, logout: jest.fn() };
    return typeof selector === 'function' ? selector(state) : state;
  },
}));

const mocked = useAdminReportsStore as unknown as jest.Mock;

const REPORT = {
  window: '30d',
  revenue: {
    total_cop: 120000,
    subscriptions_cop: 100000,
    credits_cop: 20000,
    trend: [{ month: '2026-07', cop: 120000 }],
  },
  subscriptions: { active: 2, expired: 1, canceled: 0, with_nutrition: 1, with_nutrition_pct: 50 },
  credits: { earned: 30, spent: 10, redemptions_by_status: { pending: 1, fulfilled: 0, rejected: 0 } },
  quality: { average_score: 4.5, rated_count: 4, distribution: { '1': 0, '2': 0, '3': 0, '4': 2, '5': 2 } },
};

beforeEach(() => {
  mocked.mockReturnValue({
    window: '30d',
    data: REPORT,
    loading: false,
    error: null,
    fetchReport: jest.fn(),
  });
});

it('renders the four KPI block headings', () => {
  render(<ReportsPage />);
  expect(screen.getByText('Ingresos')).toBeInTheDocument();
  expect(screen.getByText('Suscripciones')).toBeInTheDocument();
  expect(screen.getByText('Créditos')).toBeInTheDocument();
  expect(screen.getByText('Calidad')).toBeInTheDocument();
});

it('renders the window selector pills', () => {
  render(<ReportsPage />);
  expect(screen.getByRole('button', { name: 'Hoy' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: '90 días' })).toBeInTheDocument();
});
