import { render, screen, fireEvent } from '@testing-library/react';
import Input from '@/app/components/admin/Input';

afterEach(() => {
  jest.clearAllMocks();
});

describe('Input', () => {
  it('renders a textbox with the given placeholder', () => {
    render(<Input placeholder="Buscar" />);
    expect(screen.getByPlaceholderText('Buscar')).toBeInTheDocument();
  });

  it('calls onChange when the user types into the field', () => {
    const onChange = jest.fn();
    render(<Input onChange={onChange} />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'kore' } });
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('reflects the typed value on the textbox', () => {
    render(<Input onChange={() => {}} value="kore" />);
    expect(screen.getByRole('textbox')).toHaveValue('kore');
  });

  it('renders the icon node when the icon prop is provided', () => {
    render(<Input icon={<span data-testid="input-icon" />} />);
    expect(screen.getByTestId('input-icon')).toBeInTheDocument();
  });

  it('marks the textbox as disabled when the disabled prop is set', () => {
    render(<Input disabled />);
    expect(screen.getByRole('textbox')).toBeDisabled();
  });
});
