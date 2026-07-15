import { render, screen } from '@testing-library/react';
import TrendBars from '@/app/components/admin/TrendBars';

const DATA = [
  { month: '2026-02', cop: 0 },
  { month: '2026-03', cop: 500000 },
  { month: '2026-04', cop: 250000 },
];

it('renders one labeled bar per datum', () => {
  render(<TrendBars data={DATA} />);
  expect(screen.getByTestId('trend-bars').querySelectorAll('[data-bar]')).toHaveLength(3);
});

it('does not throw when all values are zero', () => {
  render(<TrendBars data={[{ month: '2026-02', cop: 0 }]} />);
  expect(screen.getByTestId('trend-bars')).toBeInTheDocument();
});
