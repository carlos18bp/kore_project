import { render, screen, act, fireEvent } from '@testing-library/react';
import RestTimer from '@/app/components/program/RestTimer';

const RADIUS = 36;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

describe('RestTimer', () => {
  let onComplete: jest.Mock;
  let onDismiss: jest.Mock;
  let setRemaining: jest.Mock;

  beforeEach(() => {
    jest.useFakeTimers();
    onComplete = jest.fn();
    onDismiss = jest.fn();
    setRemaining = jest.fn();
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
  });

  it('renders the dismiss button with text "Listo"', () => {
    render(
      <RestTimer seconds={60} remaining={60} setRemaining={setRemaining} onComplete={onComplete} onDismiss={onDismiss} />
    );

    expect(screen.getByRole('button', { name: 'Listo' })).toBeInTheDocument();
  });

  it('calls onDismiss when the dismiss button is clicked', () => {
    render(
      <RestTimer seconds={60} remaining={60} setRemaining={setRemaining} onComplete={onComplete} onDismiss={onDismiss} />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Listo' }));

    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('calls setRemaining after 1000ms interval tick', () => {
    render(
      <RestTimer seconds={60} remaining={60} setRemaining={setRemaining} onComplete={onComplete} onDismiss={onDismiss} />
    );

    act(() => {
      jest.advanceTimersByTime(1000);
    });

    expect(setRemaining).toHaveBeenCalledTimes(1);
  });

  it('setRemaining callback decrements previous value by 1', () => {
    render(
      <RestTimer seconds={60} remaining={60} setRemaining={setRemaining} onComplete={onComplete} onDismiss={onDismiss} />
    );

    act(() => {
      jest.advanceTimersByTime(1000);
    });

    const updaterFn = setRemaining.mock.calls[0][0];
    expect(updaterFn(5)).toBe(4);
  });

  it('setRemaining callback returns 0 when previous value is 1', () => {
    render(
      <RestTimer seconds={60} remaining={60} setRemaining={setRemaining} onComplete={onComplete} onDismiss={onDismiss} />
    );

    act(() => {
      jest.advanceTimersByTime(1000);
    });

    const updaterFn = setRemaining.mock.calls[0][0];
    expect(updaterFn(1)).toBe(0);
  });

  it('schedules onComplete via setTimeout when remaining reaches 1', () => {
    render(
      <RestTimer seconds={60} remaining={60} setRemaining={setRemaining} onComplete={onComplete} onDismiss={onDismiss} />
    );

    act(() => {
      jest.advanceTimersByTime(1000);
    });

    const updaterFn = setRemaining.mock.calls[0][0];
    updaterFn(1); // triggers clearInterval + setTimeout(onComplete, 0)

    act(() => {
      jest.runAllTimers();
    });

    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('displays time in "M:SS" format when seconds >= 60', () => {
    render(
      <RestTimer seconds={90} remaining={75} setRemaining={setRemaining} onComplete={onComplete} onDismiss={onDismiss} />
    );

    // 75s = 1:15
    expect(screen.getByText('1:15')).toBeInTheDocument();
  });

  it('displays time in "Ns" format when seconds < 60', () => {
    render(
      <RestTimer seconds={30} remaining={20} setRemaining={setRemaining} onComplete={onComplete} onDismiss={onDismiss} />
    );

    expect(screen.getByText('20s')).toBeInTheDocument();
  });

  it('renders SVG ring with strokeDashoffset reflecting remaining/seconds ratio', () => {
    const seconds = 60;
    const remaining = 30;
    const expectedOffset = CIRCUMFERENCE - CIRCUMFERENCE * (remaining / seconds);

    render(
      <RestTimer seconds={seconds} remaining={remaining} setRemaining={setRemaining} onComplete={onComplete} onDismiss={onDismiss} />
    );

    const circles = document.querySelectorAll('circle');
    const progressCircle = circles[1]; // second circle is the progress ring
    const dashoffset = parseFloat(progressCircle.getAttribute('stroke-dashoffset') || '0');

    expect(dashoffset).toBeCloseTo(expectedOffset, 3);
  });

  it('renders without crashing when remaining is 0', () => {
    render(
      <RestTimer seconds={60} remaining={0} setRemaining={setRemaining} onComplete={onComplete} onDismiss={onDismiss} />
    );

    expect(screen.getByRole('button', { name: 'Listo' })).toBeInTheDocument();
    expect(screen.getByText('0s')).toBeInTheDocument();
  });
});
