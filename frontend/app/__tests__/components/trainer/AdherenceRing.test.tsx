import { render, screen } from '@testing-library/react';
import AdherenceRing from '@/app/components/trainer/AdherenceRing';

describe('AdherenceRing', () => {
  it('renders the rounded percentage for a fractional value', () => {
    render(<AdherenceRing value={0.5} />);
    expect(screen.getByText('50%')).toBeInTheDocument();
  });

  it('rounds the percentage to the nearest integer', () => {
    render(<AdherenceRing value={0.736} />);
    expect(screen.getByText('74%')).toBeInTheDocument();
  });

  it('clamps a value above one to 100 percent', () => {
    render(<AdherenceRing value={1.8} />);
    expect(screen.getByText('100%')).toBeInTheDocument();
  });

  it('clamps a negative value to 0 percent', () => {
    render(<AdherenceRing value={-0.4} />);
    expect(screen.getByText('0%')).toBeInTheDocument();
  });

  it('renders the label when provided', () => {
    render(<AdherenceRing value={0.5} label="Adherencia" />);
    expect(screen.getByText('Adherencia')).toBeInTheDocument();
  });

  it('renders the sublabel when provided', () => {
    render(<AdherenceRing value={0.5} sublabel="Últimos 7 días" />);
    expect(screen.getByText('Últimos 7 días')).toBeInTheDocument();
  });

  it('omits the sublabel when not provided', () => {
    render(<AdherenceRing value={0.5} sublabel={undefined} />);
    expect(screen.queryByText('Últimos 7 días')).not.toBeInTheDocument();
  });
});
