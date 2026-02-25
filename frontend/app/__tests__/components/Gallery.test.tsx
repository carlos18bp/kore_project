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

  it('renders gallery images with alt text', () => {
    const images = screen.getAllByRole('img');
    expect(images.length).toBe(16);

    expect(screen.getAllByAltText('Estudio anatómico - espalda').length).toBeGreaterThan(0);
    expect(screen.getAllByAltText('Flor de Kóre - armonía y vitalidad').length).toBeGreaterThan(0);
    expect(screen.getAllByAltText('Silueta en movimiento').length).toBeGreaterThan(0);
    expect(screen.getAllByAltText('Espiral - origen del movimiento').length).toBeGreaterThan(0);
  });
});
