import { render, screen } from '@testing-library/react';
import Pill from '@/app/components/admin/Pill';

afterEach(() => {
  jest.clearAllMocks();
});

describe('Pill', () => {
  it('renders its children text', () => {
    render(<Pill>Activo</Pill>);
    expect(screen.getByText('Activo')).toBeInTheDocument();
  });

  it.each(['wine', 'sage', 'amber', 'sakura', 'neutral', 'dark'] as const)(
    'renders its children for the %s tone',
    (tone) => {
      render(<Pill tone={tone}>Estado</Pill>);
      expect(screen.getByText('Estado')).toBeInTheDocument();
    },
  );

  it.each(['sm', 'md'] as const)('renders its children for the %s size', (size) => {
    render(<Pill size={size}>Estado</Pill>);
    expect(screen.getByText('Estado')).toBeInTheDocument();
  });

  it('renders its children when the dot indicator is enabled', () => {
    render(<Pill dot>Online</Pill>);
    expect(screen.getByText('Online')).toBeInTheDocument();
  });
});
