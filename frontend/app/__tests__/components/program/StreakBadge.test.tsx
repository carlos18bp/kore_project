import { render, screen } from '@testing-library/react';
import StreakBadge from '@/app/components/program/StreakBadge';

describe('StreakBadge', () => {
  it('renders the current streak value', () => {
    render(<StreakBadge current={7} longest={12} />);

    expect(screen.getByText('7')).toBeInTheDocument();
  });

  it('renders the longest streak value', () => {
    render(<StreakBadge current={7} longest={12} />);

    expect(screen.getByText('12')).toBeInTheDocument();
  });

  it('renders the current streak label', () => {
    render(<StreakBadge current={7} longest={12} />);

    expect(screen.getByText('racha actual')).toBeInTheDocument();
  });

  it('renders the longest streak label', () => {
    render(<StreakBadge current={7} longest={12} />);

    expect(screen.getByText('mejor racha')).toBeInTheDocument();
  });

  it('renders zero when the current streak is empty', () => {
    render(<StreakBadge current={0} longest={0} />);

    expect(screen.getAllByText('0')).toHaveLength(2);
  });
});
