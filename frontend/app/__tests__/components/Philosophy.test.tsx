import { render, screen } from '@testing-library/react';
import Philosophy from '@/app/components/Philosophy';

jest.mock('next/image', () => ({
  __esModule: true,
  default: (props: React.ImgHTMLAttributes<HTMLImageElement>) => <img {...props} />,
}));

describe('Philosophy', () => {
  beforeEach(() => {
    render(<Philosophy />);
  });

  it('renders the section header', () => {
    expect(screen.getByText('Qué es KÓRE')).toBeInTheDocument();
    expect(screen.getByText(/KÓRE representa el origen/)).toBeInTheDocument();
  });

  it('renders all three pillars with titles', () => {
    expect(screen.getAllByText('KÓRE').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Health').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Nuestro enfoque').length).toBeGreaterThan(0);
  });

  it('renders pillar descriptions', () => {
    expect(screen.getAllByText(/El centro desde donde nace el movimiento/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Bienestar real/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Acompañamos personas completas/).length).toBeGreaterThan(0);
  });

  it('renders pillar images with correct alt text', () => {
    expect(screen.getAllByAltText('Espiral - origen del movimiento').length).toBeGreaterThan(0);
    expect(screen.getAllByAltText('Manos abiertas - acompañamiento').length).toBeGreaterThan(0);
    expect(screen.getAllByAltText('Estudio anatómico - conocimiento del cuerpo').length).toBeGreaterThan(0);
  });
});
