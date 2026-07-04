import { render, screen } from '@testing-library/react';
import GlowRing from '@/app/components/shared/GlowRing';

afterEach(() => {
  jest.useRealTimers();
  jest.clearAllMocks();
  localStorage.clear();
});

describe('GlowRing', () => {
  it('renders the centered children content', () => {
    render(<GlowRing value={92}><span>92%</span></GlowRing>);
    expect(screen.getByText('92%')).toBeInTheDocument();
  });

  it('renders without children content', () => {
    render(<GlowRing value={50} />);
    expect(screen.queryByText('50%')).not.toBeInTheDocument();
  });

  it('renders children even when value exceeds the maximum', () => {
    render(<GlowRing value={150}><span>full</span></GlowRing>);
    expect(screen.getByText('full')).toBeInTheDocument();
  });

  it('renders children even when value is below zero', () => {
    render(<GlowRing value={-20}><span>empty</span></GlowRing>);
    expect(screen.getByText('empty')).toBeInTheDocument();
  });
});
