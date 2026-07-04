import { render, screen } from '@testing-library/react';
import ComparisonCard from '@/app/components/program/ComparisonCard';

describe('ComparisonCard', () => {
  it('renders the metric label', () => {
    render(<ComparisonCard label="Peso corporal" before={80} after={78} delta={-2} />);

    expect(screen.getByText('Peso corporal')).toBeInTheDocument();
  });

  it('formats the before value with the given decimals and unit', () => {
    render(<ComparisonCard label="Peso" before={80.4} after={78.1} delta={-2.3} unit=" kg" />);

    expect(screen.getByText('80.4 kg')).toBeInTheDocument();
  });

  it('formats the after value with the given decimals and unit', () => {
    render(<ComparisonCard label="Peso" before={80.4} after={78.1} delta={-2.3} unit=" kg" />);

    expect(screen.getByText('78.1 kg')).toBeInTheDocument();
  });

  it('renders a dash when the before value is null', () => {
    render(<ComparisonCard label="Peso" before={null} after={78} delta={null} />);

    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('prefixes a plus sign for a positive delta', () => {
    render(<ComparisonCard label="Fuerza" before={40} after={45} delta={5} unit=" kg" />);

    expect(screen.getByText('+5.0 kg')).toBeInTheDocument();
  });

  it('renders a negative delta without a plus prefix', () => {
    render(<ComparisonCard label="Peso" before={80} after={78} delta={-2} unit=" kg" />);

    expect(screen.getByText('-2.0 kg')).toBeInTheDocument();
  });

  it('omits the signed delta chip when delta is null', () => {
    render(<ComparisonCard label="Peso" before={80} after={76} delta={null} />);

    expect(screen.queryByText(/^[+-]/)).not.toBeInTheDocument();
  });

  it('formats values with zero decimals when decimals is zero', () => {
    render(<ComparisonCard label="Pasos" before={9000} after={11000} delta={2000} decimals={0} />);

    expect(screen.getByText('11000')).toBeInTheDocument();
  });
});
