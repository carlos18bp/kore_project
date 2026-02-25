import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import NequiPaymentForm from '@/app/components/checkout/NequiPaymentForm';

describe('NequiPaymentForm', () => {
  const defaultProps = {
    onSubmit: jest.fn().mockResolvedValue(undefined),
    isProcessing: false,
    amount: '$300,000 COP',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders phone input and submit button', () => {
    render(<NequiPaymentForm {...defaultProps} />);

    expect(screen.getByLabelText('Número de celular Nequi')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: `Pagar ${defaultProps.amount} con Nequi` })).toBeInTheDocument();
  });

  it('renders informational text about Nequi notification', () => {
    render(<NequiPaymentForm {...defaultProps} />);
    expect(screen.getByText(/Recibirás una notificación en tu app Nequi/)).toBeInTheDocument();
  });

  it('renders country prefix +57', () => {
    render(<NequiPaymentForm {...defaultProps} />);
    expect(screen.getByText('+57')).toBeInTheDocument();
  });

  it('limits phone input to 10 digits', async () => {
    const user = userEvent.setup();
    render(<NequiPaymentForm {...defaultProps} />);

    const input = screen.getByLabelText('Número de celular Nequi');
    await user.type(input, '30012345678901');

    expect(input).toHaveValue('3001234567');
  });

  it('strips non-digit characters from phone input', async () => {
    const user = userEvent.setup();
    render(<NequiPaymentForm {...defaultProps} />);

    const input = screen.getByLabelText('Número de celular Nequi');
    await user.type(input, '300-123-4567');

    expect(input).toHaveValue('3001234567');
  });

  it('shows error for phone number shorter than 10 digits on submit', async () => {
    const user = userEvent.setup();
    render(<NequiPaymentForm {...defaultProps} />);

    const input = screen.getByLabelText('Número de celular Nequi');
    await user.type(input, '300123');
    await user.click(screen.getByRole('button', { name: `Pagar ${defaultProps.amount} con Nequi` }));

    expect(screen.getByText('El número debe tener 10 dígitos')).toBeInTheDocument();
    expect(defaultProps.onSubmit).not.toHaveBeenCalled();
  });

  it('shows error for phone not starting with 3', async () => {
    const user = userEvent.setup();
    render(<NequiPaymentForm {...defaultProps} />);

    const input = screen.getByLabelText('Número de celular Nequi');
    await user.type(input, '1001234567');
    await user.click(screen.getByRole('button', { name: `Pagar ${defaultProps.amount} con Nequi` }));

    expect(screen.getByText('Ingresa un número de celular válido')).toBeInTheDocument();
    expect(defaultProps.onSubmit).not.toHaveBeenCalled();
  });

  it('calls onSubmit with cleaned phone number on valid submission', async () => {
    const user = userEvent.setup();
    render(<NequiPaymentForm {...defaultProps} />);

    await user.type(screen.getByLabelText('Número de celular Nequi'), '3001234567');
    await user.click(screen.getByRole('button', { name: `Pagar ${defaultProps.amount} con Nequi` }));

    await waitFor(() => {
      expect(defaultProps.onSubmit).toHaveBeenCalledWith('3001234567');
    });
  });

  it('validates on change after field is touched via blur', async () => {
    const user = userEvent.setup();
    render(<NequiPaymentForm {...defaultProps} />);

    const input = screen.getByLabelText('Número de celular Nequi');
    await user.type(input, '300');
    await user.tab();

    expect(screen.getByText('El número debe tener 10 dígitos')).toBeInTheDocument();

    await user.type(input, '1234567');

    await waitFor(() => {
      expect(screen.queryByText('El número debe tener 10 dígitos')).not.toBeInTheDocument();
    });
  });

  it('disables input and button when isProcessing is true', () => {
    render(<NequiPaymentForm {...defaultProps} isProcessing={true} />);

    expect(screen.getByLabelText('Número de celular Nequi')).toBeDisabled();
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('shows processing text when isProcessing is true', () => {
    render(<NequiPaymentForm {...defaultProps} isProcessing={true} />);
    expect(screen.getByText('Esperando confirmación en Nequi...')).toBeInTheDocument();
  });

  it('disables input when disabled prop is true', () => {
    render(<NequiPaymentForm {...defaultProps} disabled={true} />);
    expect(screen.getByLabelText('Número de celular Nequi')).toBeDisabled();
  });

  it('disables submit button when phone is empty', () => {
    render(<NequiPaymentForm {...defaultProps} />);
    expect(screen.getByRole('button', { name: `Pagar ${defaultProps.amount} con Nequi` })).toBeDisabled();
  });

  it('renders Nequi help text', () => {
    render(<NequiPaymentForm {...defaultProps} />);
    expect(screen.getByText(/Asegúrate de tener la app Nequi instalada/)).toBeInTheDocument();
  });
});
