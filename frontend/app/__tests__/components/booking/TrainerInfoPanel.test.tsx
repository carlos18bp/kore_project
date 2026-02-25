import { render, screen } from '@testing-library/react';
import TrainerInfoPanel from '@/app/components/booking/TrainerInfoPanel';
import type { Trainer, Slot } from '@/lib/stores/bookingStore';

const MOCK_TRAINER: Trainer = {
  id: 1,
  user_id: 10,
  first_name: 'Germán',
  last_name: 'Franco',
  email: 'trainer@kore.com',
  specialty: 'Funcional',
  bio: '',
  location: 'Studio A',
  session_duration_minutes: 45,
};

const MOCK_SLOT: Slot = {
  id: 5,
  trainer_id: 1,
  starts_at: '2025-03-01T10:00:00Z',
  ends_at: '2025-03-01T11:00:00Z',
  is_active: true,
  is_blocked: false,
};

describe('TrainerInfoPanel', () => {
  it('renders trainer name and specialty', () => {
    render(<TrainerInfoPanel trainer={MOCK_TRAINER} />);
    expect(screen.getByText('Germán Franco')).toBeInTheDocument();
    expect(screen.getByText('Funcional')).toBeInTheDocument();
  });

  it('renders session duration from trainer', () => {
    render(<TrainerInfoPanel trainer={MOCK_TRAINER} />);
    expect(screen.getByText('45 min')).toBeInTheDocument();
  });

  it('renders location details', () => {
    render(<TrainerInfoPanel trainer={MOCK_TRAINER} />);
    expect(screen.getByText('En persona')).toBeInTheDocument();
    expect(screen.getByText('Bogotá, Colombia')).toBeInTheDocument();
  });

  it('renders fallback "KÓRE" when trainer is null', () => {
    render(<TrainerInfoPanel trainer={null} />);
    expect(screen.getByText('KÓRE')).toBeInTheDocument();
    expect(screen.getByText('K')).toBeInTheDocument();
  });

  it('renders default 60 min duration when trainer is null', () => {
    render(<TrainerInfoPanel trainer={null} />);
    expect(screen.getByText('60 min')).toBeInTheDocument();
  });

  it('renders trainer initial in avatar', () => {
    render(<TrainerInfoPanel trainer={MOCK_TRAINER} />);
    expect(screen.getByText('G')).toBeInTheDocument();
  });

  it('renders without error when selectedSlot is provided', () => {
    render(<TrainerInfoPanel trainer={MOCK_TRAINER} selectedSlot={MOCK_SLOT} />);
    expect(screen.getByText('Germán Franco')).toBeInTheDocument();
  });

  it('renders without error when no slot is selected', () => {
    render(<TrainerInfoPanel trainer={MOCK_TRAINER} />);
    expect(screen.getByText('Germán Franco')).toBeInTheDocument();
  });

  it('renders without error when custom timezone is provided', () => {
    render(<TrainerInfoPanel trainer={MOCK_TRAINER} timezone="America/Bogota" />);
    expect(screen.getByText('Germán Franco')).toBeInTheDocument();
  });
});
