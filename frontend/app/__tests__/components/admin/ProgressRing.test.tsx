import { render, screen } from '@testing-library/react';
import ProgressRing from '@/app/components/admin/ProgressRing';

afterEach(() => {
  jest.clearAllMocks();
});

describe('ProgressRing', () => {
  it('renders the used sessions count', () => {
    render(<ProgressRing used={3} total={10} />);
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('renders the total sessions count', () => {
    render(<ProgressRing used={3} total={10} />);
    expect(screen.getByText('/10')).toBeInTheDocument();
  });

  it('renders the default label', () => {
    render(<ProgressRing used={3} total={10} />);
    expect(screen.getByText('Sesiones')).toBeInTheDocument();
  });

  it('renders a custom label when provided', () => {
    render(<ProgressRing used={3} total={10} label="Clases" />);
    expect(screen.getByText('Clases')).toBeInTheDocument();
  });

  it('renders the total as zero when there are no sessions', () => {
    render(<ProgressRing used={0} total={0} />);
    expect(screen.getByText('/0')).toBeInTheDocument();
  });
});
