import { render, screen } from '@testing-library/react';
import TrainerNoteHero from '@/app/components/shared/TrainerNoteHero';

afterEach(() => {
  jest.useRealTimers();
  jest.clearAllMocks();
  localStorage.clear();
});

describe('TrainerNoteHero', () => {
  it.each(['', '   '])('renders nothing when the note is %s', (note) => {
    const { container } = render(<TrainerNoteHero note={note} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders the trimmed note text', () => {
    render(<TrainerNoteHero note="  Buen progreso esta semana  " />);
    expect(screen.getByText(/Buen progreso esta semana/)).toBeInTheDocument();
  });

  it('renders the default kicker label', () => {
    render(<TrainerNoteHero note="Sigue así" />);
    expect(screen.getByText('Notas de tu trainer')).toBeInTheDocument();
  });

  it('renders a custom kicker label', () => {
    render(<TrainerNoteHero note="Sigue así" kicker="Mensaje" />);
    expect(screen.getByText('Mensaje')).toBeInTheDocument();
  });

  it('renders the provided trainer name as the author', () => {
    render(<TrainerNoteHero note="Sigue así" trainerName="Ana" />);
    expect(screen.getByText(/— Ana/)).toBeInTheDocument();
  });

  it('falls back to the default author when trainerName is null', () => {
    render(<TrainerNoteHero note="Sigue así" trainerName={null} />);
    expect(screen.getByText(/— Tu entrenador/)).toBeInTheDocument();
  });

  it('renders the formatted long date for a date-only string', () => {
    render(<TrainerNoteHero note="Sigue así" date="2026-05-10" />);
    expect(screen.getByText(/10 de mayo de 2026/)).toBeInTheDocument();
  });

  it('renders the formatted long date for an ISO timestamp', () => {
    render(<TrainerNoteHero note="Sigue así" date="2026-05-10T12:00:00" />);
    expect(screen.getByText(/10 de mayo de 2026/)).toBeInTheDocument();
  });

  it('omits the date when the date string is invalid', () => {
    render(<TrainerNoteHero note="Sigue así" trainerName="Ana" date="not-a-date" />);
    expect(screen.queryByText(/mayo/)).not.toBeInTheDocument();
  });
});
