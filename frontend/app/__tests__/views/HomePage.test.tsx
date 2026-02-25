import { render, screen } from '@testing-library/react';
import HomePage from '@/app/(public)/page';

jest.mock('next/image', () => ({
  __esModule: true,
  default: (props: React.ImgHTMLAttributes<HTMLImageElement>) => <img {...props} />,
}));

describe('HomePage', () => {
  beforeEach(() => {
    render(<HomePage />);
  });

  it('renders the Hero section', () => {
    expect(screen.getAllByText('KÓRE').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Health').length).toBeGreaterThan(0);
  });

  it('renders the Philosophy section', () => {
    expect(screen.getByText('Qué es KÓRE')).toBeInTheDocument();
  });

  it('renders the PricingTable section', () => {
    expect(screen.getByText('Tarifas 2026')).toBeInTheDocument();
  });

  it('renders the Process section', () => {
    expect(screen.getByText('Cómo funciona')).toBeInTheDocument();
  });

  it('renders the Gallery section', () => {
    expect(screen.getByText('Estilo visual')).toBeInTheDocument();
  });
});
