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
    expect(screen.getByText('KÓRE Health')).toBeInTheDocument();
    expect(screen.getByText('Vuelve')).toBeInTheDocument();
    expect(screen.getByText('al centro')).toBeInTheDocument();
  });

  it('renders the subtitle', () => {
    expect(screen.getByText(/Un proceso de movimiento consciente/)).toBeInTheDocument();
  });

  it('renders the body text', () => {
    expect(screen.getByText(/Tu proceso no empieza con una rutina/)).toBeInTheDocument();
  });

  it('renders CTA links', () => {
    expect(screen.getByText('Agenda tu valoración gratis')).toBeInTheDocument();
    expect(screen.getByText('Ver programas')).toBeInTheDocument();
  });

  it('renders the hero image with correct alt text', () => {
    expect(screen.getByAltText('Flor de Kóre - símbolo de armonía y vitalidad')).toBeInTheDocument();
  });
});
