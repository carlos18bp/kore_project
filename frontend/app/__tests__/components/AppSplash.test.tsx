import { render, screen } from '@testing-library/react';
import AppSplash from '@/app/components/layouts/AppSplash';

describe('AppSplash', () => {
  afterEach(() => {
    jest.clearAllMocks();
    // @ts-expect-error cleaning up the optional matchMedia stub between tests
    delete window.matchMedia;
  });

  it('renders a polite status region labelled as loading', () => {
    render(<AppSplash />);

    expect(screen.getByRole('status', { name: 'Cargando' })).toBeInTheDocument();
  });

  it('renders each letter of the KÓRE wordmark', () => {
    render(<AppSplash />);

    expect(screen.getByText('K')).toBeInTheDocument();
    expect(screen.getByText('Ó')).toBeInTheDocument();
    expect(screen.getByText('R')).toBeInTheDocument();
    expect(screen.getByText('E')).toBeInTheDocument();
  });

  it('invokes onEntranceComplete after the entrance timeline plays', () => {
    const onEntranceComplete = jest.fn();

    render(<AppSplash onEntranceComplete={onEntranceComplete} />);

    expect(onEntranceComplete).toHaveBeenCalledTimes(1);
  });

  it('invokes onEntranceComplete immediately when reduced motion is preferred', () => {
    window.matchMedia = jest.fn().mockReturnValue({ matches: true }) as unknown as typeof window.matchMedia;
    const onEntranceComplete = jest.fn();

    render(<AppSplash onEntranceComplete={onEntranceComplete} />);

    expect(onEntranceComplete).toHaveBeenCalledTimes(1);
  });
});
