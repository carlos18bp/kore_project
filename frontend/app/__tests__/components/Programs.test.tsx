import { render, screen } from '@testing-library/react';
import Programs from '@/app/components/Programs';

jest.mock('next/image', () => ({
  __esModule: true,
  default: (props: React.ImgHTMLAttributes<HTMLImageElement>) => <img {...props} />,
}));

describe('Programs', () => {
  beforeEach(() => {
    render(<Programs />);
  });

  it('renders the section header', () => {
    expect(screen.getByText('Programas FLW')).toBeInTheDocument();
    expect(screen.getByText('Tres caminos, un mismo centro')).toBeInTheDocument();
  });

  it('renders all three program names', () => {
    expect(screen.getByText('Personalizado FLW')).toBeInTheDocument();
    expect(screen.getByText('Semi-personalizado FLW')).toBeInTheDocument();
    expect(screen.getByText('Terapéutico FLW')).toBeInTheDocument();
  });

  it('renders program taglines', () => {
    expect(screen.getByText('Tu proceso, tu ritmo')).toBeInTheDocument();
    expect(screen.getByText('Comparte el camino')).toBeInTheDocument();
    expect(screen.getByText('Movimiento como medicina')).toBeInTheDocument();
  });

  it('renders features for each program', () => {
    expect(screen.getByText('Sesiones individuales 1 a 1')).toBeInTheDocument();
    expect(screen.getByText('Grupos de 2-3 personas')).toBeInTheDocument();
    expect(screen.getByText('Enfoque preventivo y terapéutico')).toBeInTheDocument();
  });

  it('renders program images with alt text', () => {
    expect(screen.getByAltText('Entrenamiento personalizado')).toBeInTheDocument();
    expect(screen.getByAltText('Entrenamiento semi-personalizado')).toBeInTheDocument();
    expect(screen.getByAltText('Entrenamiento terapéutico')).toBeInTheDocument();
  });
});
