import { render, screen, fireEvent } from '@testing-library/react';
import Toggle from '@/app/components/admin/Toggle';

afterEach(() => {
  jest.clearAllMocks();
});

describe('Toggle', () => {
  it('exposes a switch role', () => {
    render(<Toggle checked={false} onChange={() => {}} />);
    expect(screen.getByRole('switch')).toBeInTheDocument();
  });

  it.each([
    [true, 'true'],
    [false, 'false'],
  ])('reflects checked=%s as aria-checked=%s', (checked, expected) => {
    render(<Toggle checked={checked} onChange={() => {}} />);
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', expected);
  });

  it('uses the label prop as the accessible name', () => {
    render(<Toggle checked={false} onChange={() => {}} label="Activo" />);
    expect(screen.getByRole('switch', { name: 'Activo' })).toBeInTheDocument();
  });

  it('calls onChange when the switch is clicked', () => {
    const onChange = jest.fn();
    render(<Toggle checked={false} onChange={onChange} />);
    fireEvent.click(screen.getByRole('switch'));
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('does not call onChange when the disabled switch is clicked', () => {
    const onChange = jest.fn();
    render(<Toggle checked={false} onChange={onChange} disabled />);
    fireEvent.click(screen.getByRole('switch'));
    expect(onChange).not.toHaveBeenCalled();
  });
});
