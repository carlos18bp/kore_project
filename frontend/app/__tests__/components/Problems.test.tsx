import { render, screen } from '@testing-library/react';
import Problems from '@/app/components/Problems';

jest.mock('next/image', () => ({
  __esModule: true,
  default: (props: React.ImgHTMLAttributes<HTMLImageElement>) => <img {...props} />,
}));

jest.mock('@/app/composables/useScrollAnimations', () => ({
  useTextReveal: jest.fn(),
}));

jest.mock('@/app/components/MobileSwiper', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <div data-testid="mobile-swiper">{children}</div>,
}));

describe('Problems', () => {
  beforeEach(() => {
    render(<Problems />);
  });

  it('renders the section label', () => {
    expect(screen.getByText('El problema')).toBeInTheDocument();
  });

  it('renders the hero heading', () => {
    expect(screen.getByText('Lo que normalmente falla')).toBeInTheDocument();
  });

  it('renders the hero description', () => {
    expect(screen.getByText(/Entrenar sin método no es solo ineficaz/)).toBeInTheDocument();
  });

  it('renders all problem titles', () => {
    const titles = ['Rutinas genéricas', 'Entrenar con dolor', 'Falta de seguimiento', 'Progresar sin saber', 'Sentir que es obligación'];
    titles.forEach(title => {
      expect(screen.getAllByText(title).length).toBeGreaterThanOrEqual(1);
    });
  });

  it('renders the solution section heading', () => {
    expect(screen.getByText('Devolvemos sentido al movimiento')).toBeInTheDocument();
  });

  it('renders the solution label', () => {
    expect(screen.getByText('La solución KÓRE')).toBeInTheDocument();
  });

  it('renders CTA links to programs page', () => {
    const programLinks = screen.getAllByRole('link', { name: /Ver programas/i });
    expect(programLinks.length).toBeGreaterThanOrEqual(1);
    expect(programLinks[0]).toHaveAttribute('href', '/programs');
  });

  it('renders the MobileSwiper wrapper', () => {
    expect(screen.getByTestId('mobile-swiper')).toBeInTheDocument();
  });
});
