import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import ProgramCalendar from '@/app/components/program/ProgramCalendar';
import type { MonthlyProgram, ProgramDay } from '@/lib/stores/programStore';

const TRAINING_DAY: ProgramDay = {
  id: 1,
  day_number: 1,
  date: '2026-05-05',
  day_type: 'training',
  exercises: [],
};

const REST_DAY: ProgramDay = {
  id: 2,
  day_number: 2,
  date: '2026-05-06',
  day_type: 'rest',
  exercises: [],
};

const ACTIVE_REST_DAY: ProgramDay = {
  id: 3,
  day_number: 3,
  date: '2026-05-07',
  day_type: 'active_rest',
  exercises: [],
};

const MAY_2026_PROGRAM: MonthlyProgram = {
  id: 1,
  customer_id: 10,
  fitness_level: 3,
  goal: 'Mejorar condición física',
  start_date: '2026-05-01',
  end_date: '2026-05-31',
  status: 'published',
  trainer_notes: '',
  approved_at: null,
  created_at: '2026-05-01T00:00:00Z',
  days: [TRAINING_DAY, REST_DAY, ACTIVE_REST_DAY],
  booking_dates: ['2026-05-10'],
};

const MULTI_MONTH_PROGRAM: MonthlyProgram = {
  ...MAY_2026_PROGRAM,
  start_date: '2026-05-01',
  end_date: '2026-06-30',
  days: [TRAINING_DAY],
  booking_dates: [],
};

describe('ProgramCalendar', () => {
  const onSelectDay = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    // Freeze the clock to mid-May 2026 so the calendar opens on the program's
    // first month, keeping these tests independent of the real current date.
    jest.useFakeTimers();
    jest.setSystemTime(new Date(2026, 4, 15, 12));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('renders the day name headers (Lun through Dom)', () => {
    render(<ProgramCalendar program={MAY_2026_PROGRAM} onSelectDay={onSelectDay} />);

    expect(screen.getByText('Lun')).toBeInTheDocument();
    expect(screen.getByText('Mar')).toBeInTheDocument();
    expect(screen.getByText('Mié')).toBeInTheDocument();
    expect(screen.getByText('Jue')).toBeInTheDocument();
    expect(screen.getByText('Vie')).toBeInTheDocument();
    expect(screen.getByText('Sáb')).toBeInTheDocument();
    expect(screen.getByText('Dom')).toBeInTheDocument();
  });

  it('renders the legend labels', () => {
    render(<ProgramCalendar program={MAY_2026_PROGRAM} onSelectDay={onSelectDay} />);

    expect(screen.getByText('Entreno')).toBeInTheDocument();
    expect(screen.getByText('Activo')).toBeInTheDocument();
    expect(screen.getByText('Descanso')).toBeInTheDocument();
    expect(screen.getByText('Sesión')).toBeInTheDocument();
  });

  it('renders a month/year label', () => {
    render(<ProgramCalendar program={MAY_2026_PROGRAM} onSelectDay={onSelectDay} />);
    expect(screen.getByRole('heading')).toBeInTheDocument();
  });

  it('prev-month button is disabled when on the first month', () => {
    render(<ProgramCalendar program={MAY_2026_PROGRAM} onSelectDay={onSelectDay} />);

    const prevBtn = screen.getByRole('button', { name: 'Mes anterior' });
    expect(prevBtn).toBeDisabled();
  });

  it('next-month button is disabled on a single-month program', () => {
    render(<ProgramCalendar program={MAY_2026_PROGRAM} onSelectDay={onSelectDay} />);

    const nextBtn = screen.getByRole('button', { name: 'Mes siguiente' });
    expect(nextBtn).toBeDisabled();
  });

  it('next-month button is enabled on a multi-month program and navigates forward', () => {
    render(<ProgramCalendar program={MULTI_MONTH_PROGRAM} onSelectDay={onSelectDay} />);

    const nextBtn = screen.getByRole('button', { name: 'Mes siguiente' });
    expect(nextBtn).not.toBeDisabled();
    fireEvent.click(nextBtn);

    const prevBtn = screen.getByRole('button', { name: 'Mes anterior' });
    expect(prevBtn).not.toBeDisabled();
  });

  it('clicking a training-day cell calls onSelectDay with the ProgramDay', () => {
    render(<ProgramCalendar program={MAY_2026_PROGRAM} onSelectDay={onSelectDay} />);

    const trainingDayButton = screen.getByRole('button', { name: '5' });
    fireEvent.click(trainingDayButton);

    expect(onSelectDay).toHaveBeenCalledWith(TRAINING_DAY, '2026-05-05');
  });

  it('clicking a rest-day cell calls onSelectDay with the ProgramDay for that day', () => {
    render(<ProgramCalendar program={MAY_2026_PROGRAM} onSelectDay={onSelectDay} />);

    const restDayButton = screen.getByRole('button', { name: '6' });
    fireEvent.click(restDayButton);

    expect(onSelectDay).toHaveBeenCalledWith(REST_DAY, '2026-05-06');
  });

  it('booking-date cell is rendered as a clickable button', () => {
    render(<ProgramCalendar program={MAY_2026_PROGRAM} onSelectDay={onSelectDay} />);

    const bookingCell = screen.getByRole('button', { name: '10' });
    expect(bookingCell).toBeInTheDocument();
    fireEvent.click(bookingCell);
    expect(onSelectDay).toHaveBeenCalledWith(null, '2026-05-10');
  });

  it('days not in program and not in booking_dates are not buttons', () => {
    render(<ProgramCalendar program={MAY_2026_PROGRAM} onSelectDay={onSelectDay} />);

    // Day 1 is not in the program days and not a booking date
    const allButtons = screen.getAllByRole('button');
    const buttonLabels = allButtons.map((b) => b.textContent?.trim());
    // Day 1 should not be a button (no program, no booking)
    const day1Button = allButtons.find((b) => b.textContent?.trim() === '1');
    // If it's not a button, it won't be found among role=button
    expect(day1Button).toBeUndefined();
  });

  it('renders navigation arrows', () => {
    render(<ProgramCalendar program={MULTI_MONTH_PROGRAM} onSelectDay={onSelectDay} />);

    expect(screen.getByRole('button', { name: 'Mes anterior' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Mes siguiente' })).toBeInTheDocument();
  });
});
