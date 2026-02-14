import { render, screen } from '@testing-library/react';
import Gallery from '@/app/components/Gallery';

jest.mock('next/image', () => ({
  __esModule: true,
  default: (props: React.ImgHTMLAttributes<HTMLImageElement>) => <img {...props} />,
}));

describe('Gallery', () => {
  beforeEach(() => {
    render(<Gallery />);
  });

  it('renders the section header', () => {
    expect(screen.getByText('Estilo visual')).toBeInTheDocument();
    expect(screen.getByText('El cuerpo como arte y ciencia')).toBeInTheDocument();
  });

  it('renders the description paragraph', () => {
    expect(screen.getByText(/Las ilustraciones anatómicas son un elemento distintivo/)).toBeInTheDocument();
  });

  it('renders all 10 gallery images with alt text', () => {
    const images = screen.getAllByRole('img');
    expect(images.length).toBe(10);

    expect(screen.getByAltText('Estudio anatómico - espalda')).toBeInTheDocument();
    expect(screen.getByAltText('Flor de Kóre - armonía y vitalidad')).toBeInTheDocument();
    expect(screen.getByAltText('Silueta en movimiento')).toBeInTheDocument();
    expect(screen.getByAltText('Espiral - origen del movimiento')).toBeInTheDocument();
  });
});
