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
    expect(screen.getByText('Nuestra filosofía')).toBeInTheDocument();
    expect(screen.getByText('Salud que se construye desde el centro')).toBeInTheDocument();
  });

  it('renders all three pillars with titles', () => {
    expect(screen.getByText('Desde el origen')).toBeInTheDocument();
    expect(screen.getByText('Acompañamiento real')).toBeInTheDocument();
    expect(screen.getByText('Conocimiento profundo')).toBeInTheDocument();
  });

  it('renders pillar descriptions', () => {
    expect(screen.getByText(/Entrenamos desde el centro del movimiento/)).toBeInTheDocument();
    expect(screen.getByText(/No entrenamos cuerpos aislados/)).toBeInTheDocument();
    expect(screen.getByText(/Anatomía funcional, biomecánica aplicada/)).toBeInTheDocument();
  });

  it('renders pillar images with correct alt text', () => {
    expect(screen.getByAltText('Espiral - origen del movimiento')).toBeInTheDocument();
    expect(screen.getByAltText('Manos abiertas - acompañamiento')).toBeInTheDocument();
    expect(screen.getByAltText('Estudio anatómico - conocimiento del cuerpo')).toBeInTheDocument();
  });
});
