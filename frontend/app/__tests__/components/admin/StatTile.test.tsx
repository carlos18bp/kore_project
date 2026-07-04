import { render, screen } from '@testing-library/react';
import StatTile from '@/app/components/admin/StatTile';

afterEach(() => {
  jest.clearAllMocks();
});

describe('StatTile', () => {
  it('renders the kicker label', () => {
    render(<StatTile kicker="Usuarios" value={12} />);
    expect(screen.getByText('Usuarios')).toBeInTheDocument();
  });

  it('renders the numeric value', () => {
    render(<StatTile kicker="Usuarios" value={12} />);
    expect(screen.getByText('12')).toBeInTheDocument();
  });

  it('renders the hint text when provided', () => {
    render(<StatTile kicker="Usuarios" value={12} hint="ultimos 30 dias" />);
    expect(screen.getByText('ultimos 30 dias')).toBeInTheDocument();
  });

  it.each(['dark', 'sakura', 'sage', 'amber'] as const)(
    'renders the value for the %s tone',
    (tone) => {
      render(<StatTile kicker="Usuarios" value={99} tone={tone} />);
      expect(screen.getByText('99')).toBeInTheDocument();
    },
  );

  it('hides the value while loading', () => {
    render(<StatTile kicker="Usuarios" value={12} loading />);
    expect(screen.queryByText('12')).not.toBeInTheDocument();
  });
});
