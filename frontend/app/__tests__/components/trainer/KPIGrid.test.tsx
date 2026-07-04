import { render, screen } from '@testing-library/react';
import KPIGrid from '@/app/components/trainer/KPIGrid';

describe('KPIGrid', () => {
  it('renders the label of an item', () => {
    render(<KPIGrid items={[{ label: 'Peso', value: 80 }]} />);
    expect(screen.getByText('Peso')).toBeInTheDocument();
  });

  it('renders the value of an item', () => {
    render(<KPIGrid items={[{ label: 'Peso', value: 80 }]} />);
    expect(screen.getByText('80')).toBeInTheDocument();
  });

  it('renders the unit when the value is not null', () => {
    render(<KPIGrid items={[{ label: 'Peso', value: 80, unit: 'kg' }]} />);
    expect(screen.getByText('kg')).toBeInTheDocument();
  });

  it('renders an em dash placeholder when the value is null', () => {
    render(<KPIGrid items={[{ label: 'Peso', value: null }]} />);
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('hides the unit when the value is null', () => {
    render(<KPIGrid items={[{ label: 'Peso', value: null, unit: 'kg' }]} />);
    expect(screen.queryByText('kg')).not.toBeInTheDocument();
  });

  it('renders one cell per item in the list', () => {
    render(
      <KPIGrid
        items={[
          { label: 'Peso', value: 80 },
          { label: 'IMC', value: 24 },
          { label: 'Grasa', value: 18 },
        ]}
      />,
    );
    expect(screen.getByText('Peso')).toBeInTheDocument();
    expect(screen.getByText('IMC')).toBeInTheDocument();
    expect(screen.getByText('Grasa')).toBeInTheDocument();
  });
});
