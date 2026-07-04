import { render, screen } from '@testing-library/react';
import HeroOrbsCard from '@/app/components/shared/HeroOrbsCard';

afterEach(() => {
  jest.useRealTimers();
  jest.clearAllMocks();
  localStorage.clear();
});

describe('HeroOrbsCard', () => {
  it('renders the children content', () => {
    render(<HeroOrbsCard><span>Hero body</span></HeroOrbsCard>);
    expect(screen.getByText('Hero body')).toBeInTheDocument();
  });

  it('renders children when a non-default radius is given', () => {
    render(<HeroOrbsCard radius="3xl"><span>Rounded body</span></HeroOrbsCard>);
    expect(screen.getByText('Rounded body')).toBeInTheDocument();
  });
});
