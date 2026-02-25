import { render, screen } from '@testing-library/react';
import KoreBrandPage from '@/app/(public)/kore-brand/page';

jest.mock('next/image', () => ({
  __esModule: true,
  default: (props: React.ImgHTMLAttributes<HTMLImageElement>) => <img {...props} />,
}));

describe('KoreBrandPage', () => {
  beforeEach(() => {
    render(<KoreBrandPage />);
  });

  it('renders the hero section with brand heading', () => {
    expect(screen.getByText('La Marca')).toBeInTheDocument();
    expect(screen.getAllByText(/KÓRE/).length).toBeGreaterThan(0);
  });

  it('renders the subtitle', () => {
    expect(screen.getByText('Del origen, al núcleo, al movimiento consciente')).toBeInTheDocument();
  });

  it('renders "Lo que nos hace diferentes" section', () => {
    expect(screen.getByText('Nuestro enfoque')).toBeInTheDocument();
    expect(screen.getByText('Lo que nos hace diferentes')).toBeInTheDocument();
  });

  it('renders the three differentiator cards', () => {
    expect(screen.getAllByText('Desde el origen').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Salud antes que exigencia').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Procesos, no atajos').length).toBeGreaterThan(0);
  });

  it('renders the interactive flower section with pillar labels', () => {
    expect(screen.getAllByText('Equilibrio').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Consciencia').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Bienestar').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Origen').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Movimiento').length).toBeGreaterThan(0);
  });

  it('renders the diagnostic process section', () => {
    expect(screen.getByText('Tu camino en KÓRE')).toBeInTheDocument();
    expect(screen.getByText('Primer contacto')).toBeInTheDocument();
    expect(screen.getByText('Diagnóstico completo')).toBeInTheDocument();
  });

  it('renders the programs section with three programs', () => {
    expect(screen.getByText('Personalizado FLW')).toBeInTheDocument();
    expect(screen.getByText('Semi-personalizado FLW')).toBeInTheDocument();
    expect(screen.getByText('Terapéutico FLW')).toBeInTheDocument();
  });

  it('renders the seguimiento section', () => {
    expect(screen.getByText('El seguimiento es constante')).toBeInTheDocument();
    expect(screen.getByText('Ajuste progresivo')).toBeInTheDocument();
    expect(screen.getByText('Corrección postural')).toBeInTheDocument();
  });

  it('renders CTA buttons in the hero', () => {
    expect(screen.getAllByText('Nuestros programas').length).toBeGreaterThan(0);
    expect(screen.getByText('Nuestra Esencia')).toBeInTheDocument();
  });
});
