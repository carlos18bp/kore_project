import { render } from '@testing-library/react';
import {
  GoalFireIcon,
  GoalMuscleIcon,
  GoalRehabIcon,
  GoalHealthIcon,
  GoalPerformanceIcon,
  MoodMotivatedIcon,
  MoodNeutralIcon,
  MoodTiredIcon,
  GOAL_OPTIONS,
  MOOD_OPTIONS,
  MOOD_MESSAGES,
  MOOD_COLORS,
  getGoalLabel,
  getGoalIcon,
  getMoodIcon,
  getMoodLabel,
} from '@/app/components/profile/ProfileIcons';

describe('ProfileIcons — Icon components', () => {
  it.each([
    ['GoalFireIcon', GoalFireIcon],
    ['GoalMuscleIcon', GoalMuscleIcon],
    ['GoalRehabIcon', GoalRehabIcon],
    ['GoalHealthIcon', GoalHealthIcon],
    ['GoalPerformanceIcon', GoalPerformanceIcon],
    ['MoodMotivatedIcon', MoodMotivatedIcon],
    ['MoodNeutralIcon', MoodNeutralIcon],
    ['MoodTiredIcon', MoodTiredIcon],
  ])('renders %s as SVG', (_name, IconComponent) => {
    const { container } = render(<IconComponent />);
    expect(container.querySelector('svg')).toBeInTheDocument();
  });

  it('applies custom className to icon', () => {
    const { container } = render(<GoalFireIcon className="w-10 h-10" />);
    const svg = container.querySelector('svg');
    expect(svg).toHaveClass('w-10', 'h-10');
  });

  it('uses default className when none provided', () => {
    const { container } = render(<GoalFireIcon />);
    const svg = container.querySelector('svg');
    expect(svg).toHaveClass('w-6', 'h-6');
  });
});

describe('ProfileIcons — Config arrays', () => {
  it('GOAL_OPTIONS has 5 entries with value, label, and Icon', () => {
    expect(GOAL_OPTIONS).toHaveLength(5);
    GOAL_OPTIONS.forEach((opt) => {
      expect(opt).toHaveProperty('value');
      expect(opt).toHaveProperty('label');
      expect(opt).toHaveProperty('Icon');
    });
  });

  it('MOOD_OPTIONS has 3 entries with value, label, and Icon', () => {
    expect(MOOD_OPTIONS).toHaveLength(3);
    MOOD_OPTIONS.forEach((opt) => {
      expect(opt).toHaveProperty('value');
      expect(opt).toHaveProperty('label');
      expect(opt).toHaveProperty('Icon');
    });
  });

  it.each([
    ['message for motivated', 'motivated', 'Esa energía se nota. Vamos a aprovecharla.'],
    ['message for neutral', 'neutral', 'Cada día es una oportunidad. Tu cuerpo te lo agradecerá.'],
    ['message for tired', 'tired', 'Está bien tener días así. Lo importante es que estás aquí.'],
  ])('MOOD_MESSAGES has the exact %s', (_label, mood, expected) => {
    expect(MOOD_MESSAGES[mood]).toBe(expected);
  });

  it.each([
    ['classes for motivated', 'motivated', { bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200', activeBg: 'bg-green-100' }],
    ['classes for neutral', 'neutral', { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', activeBg: 'bg-amber-100' }],
    ['classes for tired', 'tired', { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200', activeBg: 'bg-rose-100' }],
  ])('MOOD_COLORS has the exact %s', (_label, mood, expected) => {
    expect(MOOD_COLORS[mood]).toEqual(expected);
  });
});

describe('ProfileIcons — Helper functions', () => {
  it('getGoalLabel returns correct label for known value', () => {
    expect(getGoalLabel('fat_loss')).toBe('Perder grasa');
    expect(getGoalLabel('muscle_gain')).toBe('Ganar masa muscular');
    expect(getGoalLabel('rehab')).toBe('Rehabilitación');
    expect(getGoalLabel('general_health')).toBe('Salud general');
    expect(getGoalLabel('sports_performance')).toBe('Rendimiento deportivo');
  });

  it('getGoalLabel returns raw value for unknown goal', () => {
    expect(getGoalLabel('unknown_goal')).toBe('unknown_goal');
  });

  it('getGoalIcon returns matching icon component for known value', () => {
    expect(getGoalIcon('fat_loss')).toBe(GoalFireIcon);
    expect(getGoalIcon('muscle_gain')).toBe(GoalMuscleIcon);
  });

  it('getGoalIcon returns GoalHealthIcon as fallback for unknown value', () => {
    expect(getGoalIcon('nonexistent')).toBe(GoalHealthIcon);
  });

  it('getMoodIcon returns matching icon component for known value', () => {
    expect(getMoodIcon('motivated')).toBe(MoodMotivatedIcon);
    expect(getMoodIcon('neutral')).toBe(MoodNeutralIcon);
    expect(getMoodIcon('tired')).toBe(MoodTiredIcon);
  });

  it('getMoodIcon returns MoodNeutralIcon as fallback for unknown value', () => {
    expect(getMoodIcon('nonexistent')).toBe(MoodNeutralIcon);
  });

  it('getMoodLabel returns correct label for known value', () => {
    expect(getMoodLabel('motivated')).toBe('Motivado');
    expect(getMoodLabel('neutral')).toBe('Neutral');
    expect(getMoodLabel('tired')).toBe('Cansado');
  });

  it('getMoodLabel returns raw value for unknown mood', () => {
    expect(getMoodLabel('unknown_mood')).toBe('unknown_mood');
  });
});
