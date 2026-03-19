import { render, screen } from '@testing-library/react';
import ForWhom from '@/app/components/ForWhom';

jest.mock('next/image', () => ({
  __esModule: true,
  default: (props: React.ImgHTMLAttributes<HTMLImageElement>) => <img {...props} />,
}));

jest.mock('@/app/composables/useScrollAnimations', () => ({
  useTextReveal: jest.fn(),
}));

describe('ForWhom', () => {
  beforeEach(() => {
    render(<ForWhom />);
  });

  it('renders the section label', () => {
    expect(screen.getByText('Para quién es')).toBeInTheDocument();
  });

  it('renders the heading', () => {
    expect(screen.getByText(/Si buscas algo más que solo entrenar/)).toBeInTheDocument();
  });

  it('renders all check items', () => {
    expect(screen.getByText(/Quieres empezar a entrenar/)).toBeInTheDocument();
    expect(screen.getByText(/Tienes dolor o molestias/)).toBeInTheDocument();
    expect(screen.getByText(/Dejaste de entrenar/)).toBeInTheDocument();
    expect(screen.getByText(/Buscas mejorar postura/)).toBeInTheDocument();
    expect(screen.getByText(/Quieres un proceso consciente/)).toBeInTheDocument();
    expect(screen.getByText(/Quieres sentirte fuerte/)).toBeInTheDocument();
  });

  it('renders "Ver programas" CTA link', () => {
    const link = screen.getByRole('link', { name: /Ver programas/i });
    expect(link).toHaveAttribute('href', '/programs');
  });

  it('renders "Escríbenos" CTA link to WhatsApp', () => {
    const link = screen.getByRole('link', { name: /Escríbenos/i });
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('renders the section image with alt text', () => {
    expect(screen.getByAltText('Entrenamiento consciente KÓRE')).toBeInTheDocument();
  });
});
