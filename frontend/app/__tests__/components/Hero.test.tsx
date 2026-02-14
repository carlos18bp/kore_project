import { render, screen } from '@testing-library/react';
import Hero from '@/app/components/Hero';

jest.mock('next/image', () => ({
  __esModule: true,
  default: (props: React.ImgHTMLAttributes<HTMLImageElement>) => <img {...props} />,
}));

describe('Hero', () => {
  beforeEach(() => {
    render(<Hero />);
  });

  it('renders the main heading with KÓRE', () => {
    expect(screen.getByText('KÓRE')).toBeInTheDocument();
    expect(screen.getByText('Health')).toBeInTheDocument();
  });

  it('renders the subtitle', () => {
    expect(screen.getByText('Del origen, al núcleo, al movimiento consciente')).toBeInTheDocument();
  });

  it('renders the body text', () => {
    expect(screen.getByText(/Acompañamos personas completas/)).toBeInTheDocument();
  });

  it('renders CTA links', () => {
    expect(screen.getByText('Ver programas')).toBeInTheDocument();
    expect(screen.getByText('Ir al dashboard')).toBeInTheDocument();
  });

  it('renders the three stats', () => {
    expect(screen.getByText('100%')).toBeInTheDocument();
    expect(screen.getByText('1 a 1')).toBeInTheDocument();
    expect(screen.getByText('360°')).toBeInTheDocument();
  });

  it('renders the hero image with correct alt text', () => {
    expect(screen.getByAltText('Flor de Kóre - símbolo de armonía y vitalidad')).toBeInTheDocument();
  });
});
