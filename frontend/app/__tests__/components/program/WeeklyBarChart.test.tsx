import { render, screen } from '@testing-library/react';
import WeeklyBarChart from '@/app/components/program/WeeklyBarChart';
import type { DayAdherence } from '@/lib/stores/progressStore';

// ── Mocks ────────────────────────────────────────────────────────────────────

jest.mock('gsap', () => {
  const mock = {
    to: jest.fn(),
    fromTo: jest.fn(),
    set: jest.fn(),
    timeline: jest.fn(() => ({ to: jest.fn(), fromTo: jest.fn() })),
  };
  return {
    __esModule: true,
    default: mock,
    gsap: mock,
    // Spread so named `import { gsap } from 'gsap'` also resolves
    ...mock,
  };
});

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeDay(overrides: Partial<DayAdherence> = {}): DayAdherence {
  return {
    date: '2026-05-12',
    day_type: 'training',
    training_adherence: 0.8,
    nutrition_adherence: 0.6,
    combined_adherence: 0.7,
    exercises_completed: 4,
    exercises_total: 5,
    meals_completed: 3,
    meals_total: 5,
    ...overrides,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

afterEach(() => {
  jest.clearAllMocks();
});

describe('WeeklyBarChart', () => {
  it('renders without crashing when days is an empty array', () => {
    const { container } = render(<WeeklyBarChart days={[]} />);
    expect(container.querySelector('svg')).toBeInTheDocument();
  });

  it('renders one SVG group per day entry', () => {
    const days = [
      makeDay({ date: '2026-05-11' }),
      makeDay({ date: '2026-05-12' }),
      makeDay({ date: '2026-05-13' }),
    ];
    const { container } = render(<WeeklyBarChart days={days} />);
    // Each day renders a <g> element
    const groups = container.querySelectorAll('svg g');
    expect(groups.length).toBe(days.length);
  });

  it('renders two bars per day (training and nutrition)', () => {
    const days = [makeDay({ date: '2026-05-12' })];
    const { container } = render(<WeeklyBarChart days={days} />);
    const bars = container.querySelectorAll('[data-bar]');
    expect(bars.length).toBe(2);
  });

  it('renders the correct number of data bars for multiple days', () => {
    const days = [
      makeDay({ date: '2026-05-11' }),
      makeDay({ date: '2026-05-12' }),
      makeDay({ date: '2026-05-13' }),
      makeDay({ date: '2026-05-14' }),
    ];
    const { container } = render(<WeeklyBarChart days={days} />);
    const bars = container.querySelectorAll('[data-bar]');
    // 2 bars (training + nutrition) per day
    expect(bars.length).toBe(days.length * 2);
  });

  it('applies rest day class to training bar when day_type is rest', () => {
    const days = [makeDay({ date: '2026-05-12', day_type: 'rest' })];
    const { container } = render(<WeeklyBarChart days={days} />);
    const bars = container.querySelectorAll('[data-bar]');
    // The first bar (training bar) should have rest class
    const trainingBar = bars[0];
    expect(trainingBar.getAttribute('class')).toContain('fill-kore-gray-dark/15');
  });

  it('applies normal class to training bar when day_type is training', () => {
    const days = [makeDay({ date: '2026-05-12', day_type: 'training' })];
    const { container } = render(<WeeklyBarChart days={days} />);
    const bars = container.querySelectorAll('[data-bar]');
    const trainingBar = bars[0];
    expect(trainingBar.getAttribute('class')).toContain('fill-kore-red');
  });

  it('renders the today indicator class for a day matching today\'s date', () => {
    // Use a fixed "today" date
    const todayStr = new Date().toISOString().slice(0, 10);
    const days = [makeDay({ date: todayStr })];
    const { container } = render(<WeeklyBarChart days={days} />);
    // The day label text element gets fill-kore-red for today
    const texts = container.querySelectorAll('text');
    expect(texts.length).toBeGreaterThan(0);
    const todayText = texts[0];
    expect(todayText.getAttribute('class')).toContain('fill-kore-red');
  });

  it('renders the non-today class for a day not matching today\'s date', () => {
    const days = [makeDay({ date: '2000-01-01' })];
    const { container } = render(<WeeklyBarChart days={days} />);
    const texts = container.querySelectorAll('text');
    const nonTodayText = texts[0];
    expect(nonTodayText.getAttribute('class')).toContain('fill-kore-gray-dark/40');
  });

  it('renders the Entreno legend label', () => {
    render(<WeeklyBarChart days={[makeDay()]} />);
    expect(screen.getByText('Entreno')).toBeInTheDocument();
  });

  it('renders the Nutrición legend label', () => {
    render(<WeeklyBarChart days={[makeDay()]} />);
    expect(screen.getByText('Nutrición')).toBeInTheDocument();
  });

  it('sets bar height proportional to training_adherence', () => {
    const CHART_H = 60;
    const days = [makeDay({ date: '2000-01-01', training_adherence: 1.0 })];
    const { container } = render(<WeeklyBarChart days={days} />);
    const bars = container.querySelectorAll('[data-bar]');
    const trainingBar = bars[0] as SVGRectElement;
    // height = Math.max(2, Math.round(1.0 * 60)) = 60
    expect(trainingBar.getAttribute('height')).toBe(String(CHART_H));
  });

  it('sets bar height proportional to nutrition_adherence', () => {
    const days = [makeDay({ date: '2000-01-01', nutrition_adherence: 0.5 })];
    const { container } = render(<WeeklyBarChart days={days} />);
    const bars = container.querySelectorAll('[data-bar]');
    const nutritionBar = bars[1] as SVGRectElement;
    // height = Math.max(2, Math.round(0.5 * 60)) = 30
    expect(nutritionBar.getAttribute('height')).toBe('30');
  });
});
