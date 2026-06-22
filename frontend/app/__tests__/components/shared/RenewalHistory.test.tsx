import { render, screen } from '@testing-library/react';
import RenewalHistory from '@/app/components/shared/RenewalHistory';
import type { RenewalHistoryItem } from '@/lib/stores/adminSubscriptionStore';

const item: RenewalHistoryItem = {
  kind: 'manual',
  period_start: '2026-05-10T00:00:00Z',
  period_end: '2026-06-10T00:00:00Z',
  sessions_granted: 8,
  package_title: 'Plan Test',
  actor_email: 'admin@kore.com',
  note: '',
  source: 'record',
  payment: { amount: '100000', currency: 'COP', provider: 'cash', status: 'confirmed' },
};

test('renders a timeline entry', () => {
  render(<RenewalHistory items={[item]} />);
  expect(screen.getByText(/Renovación manual/i)).toBeInTheDocument();
  expect(screen.getByText(/8 sesiones/i)).toBeInTheDocument();
});

test('renders empty state', () => {
  render(<RenewalHistory items={[]} />);
  expect(screen.getByText(/Sin renovaciones/i)).toBeInTheDocument();
});
