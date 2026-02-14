import { render, screen } from '@testing-library/react';
import LaMarcaKorePage from '@/app/(public)/la-marca-kore/page';

jest.mock('next/image', () => ({
  __esModule: true,
  default: (props: React.ImgHTMLAttributes<HTMLImageElement>) => <img {...props} />,
}));

describe('LaMarcaKorePage', () => {
  beforeEach(() => {
    render(<LaMarcaKorePage />);
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
    expect(screen.getByText('Desde el origen')).toBeInTheDocument();
    expect(screen.getByText('Salud antes que exigencia')).toBeInTheDocument();
    expect(screen.getByText('Procesos, no atajos')).toBeInTheDocument();
  });

  it('renders the interactive flower section with pillar labels', () => {
    expect(screen.getByText('Equilibrio')).toBeInTheDocument();
    expect(screen.getByText('Consciencia')).toBeInTheDocument();
    expect(screen.getByText('Bienestar')).toBeInTheDocument();
    expect(screen.getByText('Origen')).toBeInTheDocument();
    expect(screen.getByText('Movimiento')).toBeInTheDocument();
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
    expect(screen.getByText('Nuestros programas')).toBeInTheDocument();
    expect(screen.getByText('Nuestra esencia')).toBeInTheDocument();
  });
});
