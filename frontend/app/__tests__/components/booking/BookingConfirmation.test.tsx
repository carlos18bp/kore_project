import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import BookingConfirmation from '@/app/components/booking/BookingConfirmation';
import { useAuthStore } from '@/lib/stores/authStore';
import type { Trainer, Slot, Subscription } from '@/lib/stores/bookingStore';

jest.mock('js-cookie', () => ({
  get: jest.fn(),
  set: jest.fn(),
  remove: jest.fn(),
}));

const MOCK_TRAINER: Trainer = {
  id: 1, user_id: 10, first_name: 'Germán', last_name: 'Franco',
  email: 'trainer@kore.com', specialty: 'Funcional', bio: '',
  location: 'Studio A', session_duration_minutes: 60,
};

const MOCK_SLOT: Slot = {
  id: 5, trainer_id: 1,
  starts_at: '2025-03-01T10:00:00Z', ends_at: '2025-03-01T11:00:00Z',
  is_active: true, is_blocked: false,
};

const MOCK_SUBSCRIPTION: Subscription = {
  id: 2, customer_email: 'cust@kore.com',
  package: { id: 1, title: 'Gold', sessions_count: 12, session_duration_minutes: 60, price: '500000', currency: 'COP', validity_days: 30 },
  sessions_total: 12, sessions_used: 3, sessions_remaining: 9,
  status: 'active', starts_at: '2025-02-01T00:00:00Z', expires_at: '2025-03-01T00:00:00Z',
};

const mockUser = {
  id: '22', email: 'customer10@kore.com', first_name: 'Customer10',
  last_name: 'Kore', phone: '', role: 'customer', name: 'Customer10 Kore',
};

describe('BookingConfirmation', () => {
  const onConfirm = jest.fn();
  const onBack = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    useAuthStore.setState({ user: mockUser, isAuthenticated: true, accessToken: 'token' });
  });

  it('renders "Confirmar reserva" heading', () => {
    render(
      <BookingConfirmation trainer={MOCK_TRAINER} slot={MOCK_SLOT} subscription={MOCK_SUBSCRIPTION}
        loading={false} error={null} onConfirm={onConfirm} onBack={onBack} />
    );
    expect(screen.getByText('Confirmar reserva')).toBeInTheDocument();
  });

  it('renders user name and email', () => {
    render(
      <BookingConfirmation trainer={MOCK_TRAINER} slot={MOCK_SLOT} subscription={MOCK_SUBSCRIPTION}
        loading={false} error={null} onConfirm={onConfirm} onBack={onBack} />
    );
    expect(screen.getByText('Customer10 Kore')).toBeInTheDocument();
    expect(screen.getByText('customer10@kore.com')).toBeInTheDocument();
  });

  it('renders subscription info with sessions remaining', () => {
    render(
      <BookingConfirmation trainer={MOCK_TRAINER} slot={MOCK_SLOT} subscription={MOCK_SUBSCRIPTION}
        loading={false} error={null} onConfirm={onConfirm} onBack={onBack} />
    );
    expect(screen.getByText(/Gold/)).toBeInTheDocument();
    expect(screen.getByText(/9 sesiones restantes/)).toBeInTheDocument();
  });

  it('renders error message when provided', () => {
    render(
      <BookingConfirmation trainer={MOCK_TRAINER} slot={MOCK_SLOT} subscription={null}
        loading={false} error="Slot already booked." onConfirm={onConfirm} onBack={onBack} />
    );
    expect(screen.getByText('Slot already booked.')).toBeInTheDocument();
  });

  it('does not render error when null', () => {
    render(
      <BookingConfirmation trainer={MOCK_TRAINER} slot={MOCK_SLOT} subscription={null}
        loading={false} error={null} onConfirm={onConfirm} onBack={onBack} />
    );
    expect(screen.queryByText('Slot already booked.')).not.toBeInTheDocument();
  });

  it('calls onConfirm when Confirmar button clicked', async () => {
    const user = userEvent.setup();
    render(
      <BookingConfirmation trainer={MOCK_TRAINER} slot={MOCK_SLOT} subscription={null}
        loading={false} error={null} onConfirm={onConfirm} onBack={onBack} />
    );
    await user.click(screen.getByText('Confirmar'));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('calls onBack when Atrás button clicked', async () => {
    const user = userEvent.setup();
    render(
      <BookingConfirmation trainer={MOCK_TRAINER} slot={MOCK_SLOT} subscription={null}
        loading={false} error={null} onConfirm={onConfirm} onBack={onBack} />
    );
    await user.click(screen.getByText('Atrás'));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('shows "Confirmando..." text while loading', () => {
    render(
      <BookingConfirmation trainer={MOCK_TRAINER} slot={MOCK_SLOT} subscription={null}
        loading={true} error={null} onConfirm={onConfirm} onBack={onBack} />
    );
    expect(screen.getByText('Confirmando...')).toBeInTheDocument();
  });

  it('disables buttons while loading', () => {
    render(
      <BookingConfirmation trainer={MOCK_TRAINER} slot={MOCK_SLOT} subscription={null}
        loading={true} error={null} onConfirm={onConfirm} onBack={onBack} />
    );
    expect(screen.getByText('Confirmando...')).toBeDisabled();
    expect(screen.getByText('Atrás')).toBeDisabled();
  });
});
