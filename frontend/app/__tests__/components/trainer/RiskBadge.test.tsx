import { render, screen } from '@testing-library/react';
import RiskBadge from '@/app/components/trainer/RiskBadge';
import type { RiskLevel } from '@/lib/stores/trainerStore';

describe('RiskBadge', () => {
  it.each([
    ['alto', 'Alto riesgo'],
    ['medio', 'Riesgo medio'],
    ['bajo', 'Riesgo bajo'],
    ['sin_riesgo', 'Sin riesgo'],
  ] as [RiskLevel, string][])('renders the %s level label', (level, label) => {
    render(<RiskBadge level={level} />);
    expect(screen.getByText(label)).toBeInTheDocument();
  });

  it('falls back to the sin-riesgo label for an unknown level', () => {
    render(<RiskBadge level={'desconocido' as RiskLevel} />);
    expect(screen.getByText('Sin riesgo')).toBeInTheDocument();
  });

  it('applies the small size class when size is sm', () => {
    render(<RiskBadge level="alto" size="sm" />);
    expect(screen.getByText('Alto riesgo')).toHaveClass('text-[10px]');
  });

  it('applies the medium size class by default', () => {
    render(<RiskBadge level="alto" />);
    expect(screen.getByText('Alto riesgo')).toHaveClass('text-xs');
  });
});
