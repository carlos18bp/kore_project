import { render, screen } from '@testing-library/react';
import ComingSoon from '@/app/components/shared/ComingSoon';

afterEach(() => {
  jest.useRealTimers();
  jest.clearAllMocks();
  localStorage.clear();
});

describe('ComingSoon', () => {
  it('renders the Próximamente heading', () => {
    render(<ComingSoon section="Nutrición" />);
    expect(screen.getByRole('heading', { name: 'Próximamente' })).toBeInTheDocument();
  });

  it('renders the provided section label', () => {
    render(<ComingSoon section="Nutrición" />);
    expect(screen.getByText('Nutrición')).toBeInTheDocument();
  });

  it('renders the construction notice', () => {
    render(<ComingSoon section="Nutrición" />);
    expect(screen.getByText(/en construcción/i)).toBeInTheDocument();
  });
});
