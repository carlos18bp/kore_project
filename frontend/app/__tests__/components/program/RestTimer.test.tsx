import { render, screen, fireEvent, act } from '@testing-library/react';
import RestTimer from '@/app/components/program/RestTimer';

describe('RestTimer', () => {
  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  it('renders the rest heading', () => {
    render(
      <RestTimer
        seconds={60}
        remaining={45}
        setRemaining={jest.fn()}
        onComplete={jest.fn()}
        onDismiss={jest.fn()}
      />,
    );

    expect(screen.getByText('Descanso')).toBeInTheDocument();
  });

  it('renders a minutes and seconds label when remaining is at least a minute', () => {
    render(
      <RestTimer
        seconds={90}
        remaining={65}
        setRemaining={jest.fn()}
        onComplete={jest.fn()}
        onDismiss={jest.fn()}
      />,
    );

    expect(screen.getByText('1:05')).toBeInTheDocument();
  });

  it('renders a seconds-only label when remaining is under a minute', () => {
    render(
      <RestTimer
        seconds={60}
        remaining={45}
        setRemaining={jest.fn()}
        onComplete={jest.fn()}
        onDismiss={jest.fn()}
      />,
    );

    expect(screen.getByText('45s')).toBeInTheDocument();
  });

  it('calls onDismiss when the ready button is clicked', () => {
    const onDismiss = jest.fn();
    render(
      <RestTimer
        seconds={60}
        remaining={45}
        setRemaining={jest.fn()}
        onComplete={jest.fn()}
        onDismiss={onDismiss}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Listo' }));

    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('decrements the remaining value on each interval tick', () => {
    jest.useFakeTimers();
    const setRemaining = jest.fn();
    render(
      <RestTimer
        seconds={60}
        remaining={45}
        setRemaining={setRemaining}
        onComplete={jest.fn()}
        onDismiss={jest.fn()}
      />,
    );

    act(() => {
      jest.advanceTimersByTime(1000);
    });
    const updater = setRemaining.mock.calls.at(-1)![0] as (prev: number) => number;

    expect(updater(45)).toBe(44);
  });

  it('resolves the countdown to zero on the final tick', () => {
    jest.useFakeTimers();
    const setRemaining = jest.fn();
    render(
      <RestTimer
        seconds={60}
        remaining={1}
        setRemaining={setRemaining}
        onComplete={jest.fn()}
        onDismiss={jest.fn()}
      />,
    );

    act(() => {
      jest.advanceTimersByTime(1000);
    });
    const updater = setRemaining.mock.calls.at(-1)![0] as (prev: number) => number;

    expect(updater(1)).toBe(0);
  });

  it('fires onComplete once the final tick logic runs', () => {
    jest.useFakeTimers();
    const setRemaining = jest.fn();
    const onComplete = jest.fn();
    render(
      <RestTimer
        seconds={60}
        remaining={1}
        setRemaining={setRemaining}
        onComplete={onComplete}
        onDismiss={jest.fn()}
      />,
    );

    act(() => {
      jest.advanceTimersByTime(1000);
    });
    const updater = setRemaining.mock.calls.at(-1)![0] as (prev: number) => number;
    act(() => {
      updater(1);
      jest.advanceTimersByTime(0);
    });

    expect(onComplete).toHaveBeenCalledTimes(1);
  });
});
