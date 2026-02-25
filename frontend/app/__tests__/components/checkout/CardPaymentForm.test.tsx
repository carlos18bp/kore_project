import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CardPaymentForm from '@/app/components/checkout/CardPaymentForm';

describe('CardPaymentForm', () => {
  const defaultProps = {
    onSubmit: jest.fn().mockResolvedValue(undefined),
    isProcessing: false,
    amount: '$300,000 COP',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders all form fields', () => {
    render(<CardPaymentForm {...defaultProps} />);

    expect(screen.getByLabelText('Número de tarjeta')).toBeInTheDocument();
    expect(screen.getByLabelText('Vencimiento')).toBeInTheDocument();
    expect(screen.getByLabelText('CVV')).toBeInTheDocument();
    expect(screen.getByLabelText('Nombre en la tarjeta')).toBeInTheDocument();
  });

  it('renders submit button with amount', () => {
    render(<CardPaymentForm {...defaultProps} />);
    expect(screen.getByRole('button', { name: `Pagar ${defaultProps.amount}` })).toBeInTheDocument();
  });

  it('formats card number into groups of four', async () => {
    const user = userEvent.setup();
    render(<CardPaymentForm {...defaultProps} />);

    const input = screen.getByLabelText('Número de tarjeta');
    await user.type(input, '4111111111111111');

    expect(input).toHaveValue('4111 1111 1111 1111');
  });

  it('formats expiry with slash separator', async () => {
    const user = userEvent.setup();
    render(<CardPaymentForm {...defaultProps} />);

    const input = screen.getByLabelText('Vencimiento');
    await user.type(input, '1228');

    expect(input).toHaveValue('12/28');
  });

  it('limits CVV to 4 digits', async () => {
    const user = userEvent.setup();
    render(<CardPaymentForm {...defaultProps} />);

    const input = screen.getByLabelText('CVV');
    await user.type(input, '12345');

    expect(input).toHaveValue('1234');
  });

  it('shows visa brand for card starting with 4', async () => {
    const user = userEvent.setup();
    render(<CardPaymentForm {...defaultProps} />);

    await user.type(screen.getByLabelText('Número de tarjeta'), '4111');

    expect(screen.getByText('visa')).toBeInTheDocument();
  });

  it('shows mastercard brand for card starting with 51', async () => {
    const user = userEvent.setup();
    render(<CardPaymentForm {...defaultProps} />);

    await user.type(screen.getByLabelText('Número de tarjeta'), '5111');

    expect(screen.getByText('mastercard')).toBeInTheDocument();
  });

  it('shows mastercard brand for card starting with 22', async () => {
    const user = userEvent.setup();
    render(<CardPaymentForm {...defaultProps} />);

    await user.type(screen.getByLabelText('Número de tarjeta'), '2211');

    expect(screen.getByText('mastercard')).toBeInTheDocument();
  });

  it('shows amex brand for card starting with 34', async () => {
    const user = userEvent.setup();
    render(<CardPaymentForm {...defaultProps} />);

    await user.type(screen.getByLabelText('Número de tarjeta'), '3411');

    expect(screen.getByText('amex')).toBeInTheDocument();
  });

  it('does not show brand for unrecognized card number', async () => {
    const user = userEvent.setup();
    render(<CardPaymentForm {...defaultProps} />);

    await user.type(screen.getByLabelText('Número de tarjeta'), '9999');

    expect(screen.queryByText('visa')).not.toBeInTheDocument();
    expect(screen.queryByText('mastercard')).not.toBeInTheDocument();
    expect(screen.queryByText('amex')).not.toBeInTheDocument();
  });

  it('shows validation error for invalid card number on blur', async () => {
    const user = userEvent.setup();
    render(<CardPaymentForm {...defaultProps} />);

    const input = screen.getByLabelText('Número de tarjeta');
    await user.type(input, '123');
    await user.tab();
    await user.click(screen.getByRole('button', { name: `Pagar ${defaultProps.amount}` }));

    expect(screen.getByText('Número de tarjeta inválido')).toBeInTheDocument();
  });

  it('shows validation error for expired card', async () => {
    const user = userEvent.setup();
    render(<CardPaymentForm {...defaultProps} />);

    await user.type(screen.getByLabelText('Número de tarjeta'), '4111111111111111');
    await user.type(screen.getByLabelText('Vencimiento'), '0120');
    await user.type(screen.getByLabelText('CVV'), '123');
    await user.type(screen.getByLabelText('Nombre en la tarjeta'), 'JUAN PEREZ');
    await user.click(screen.getByRole('button', { name: `Pagar ${defaultProps.amount}` }));

    expect(screen.getByText('Tarjeta vencida')).toBeInTheDocument();
  });

  it('shows validation error for invalid expiry month', async () => {
    const user = userEvent.setup();
    render(<CardPaymentForm {...defaultProps} />);

    await user.type(screen.getByLabelText('Número de tarjeta'), '4111111111111111');
    await user.type(screen.getByLabelText('Vencimiento'), '1399');
    await user.type(screen.getByLabelText('CVV'), '123');
    await user.type(screen.getByLabelText('Nombre en la tarjeta'), 'JUAN PEREZ');
    await user.click(screen.getByRole('button', { name: `Pagar ${defaultProps.amount}` }));

    expect(screen.getByText('Fecha inválida')).toBeInTheDocument();
  });

  it('shows validation error for invalid CVV', async () => {
    const user = userEvent.setup();
    render(<CardPaymentForm {...defaultProps} />);

    await user.type(screen.getByLabelText('Número de tarjeta'), '4111111111111111');
    await user.type(screen.getByLabelText('Vencimiento'), '1230');
    await user.type(screen.getByLabelText('CVV'), '12');
    await user.type(screen.getByLabelText('Nombre en la tarjeta'), 'JUAN PEREZ');
    await user.click(screen.getByRole('button', { name: `Pagar ${defaultProps.amount}` }));

    expect(screen.getByText('CVV inválido')).toBeInTheDocument();
  });

  it('shows validation error for short cardholder name', async () => {
    const user = userEvent.setup();
    render(<CardPaymentForm {...defaultProps} />);

    await user.type(screen.getByLabelText('Número de tarjeta'), '4111111111111111');
    await user.type(screen.getByLabelText('Vencimiento'), '1230');
    await user.type(screen.getByLabelText('CVV'), '123');
    await user.type(screen.getByLabelText('Nombre en la tarjeta'), 'AB');
    await user.click(screen.getByRole('button', { name: `Pagar ${defaultProps.amount}` }));

    expect(screen.getByText('Nombre debe tener al menos 5 caracteres')).toBeInTheDocument();
  });

  it('does not call onSubmit when validation fails', async () => {
    const user = userEvent.setup();
    render(<CardPaymentForm {...defaultProps} />);

    await user.click(screen.getByRole('button', { name: `Pagar ${defaultProps.amount}` }));

    expect(defaultProps.onSubmit).not.toHaveBeenCalled();
  });

  it('calls onSubmit with formatted card data on valid submission', async () => {
    const user = userEvent.setup();
    render(<CardPaymentForm {...defaultProps} />);

    await user.type(screen.getByLabelText('Número de tarjeta'), '4111111111111111');
    await user.type(screen.getByLabelText('Vencimiento'), '1230');
    await user.type(screen.getByLabelText('CVV'), '123');
    await user.type(screen.getByLabelText('Nombre en la tarjeta'), 'Juan Perez');
    await user.click(screen.getByRole('button', { name: `Pagar ${defaultProps.amount}` }));

    await waitFor(() => {
      expect(defaultProps.onSubmit).toHaveBeenCalledWith({
        number: '4111111111111111',
        cvc: '123',
        exp_month: '12',
        exp_year: '30',
        card_holder: 'JUAN PEREZ',
      });
    });
  });

  it('disables all inputs when isProcessing is true', () => {
    render(<CardPaymentForm {...defaultProps} isProcessing={true} />);

    expect(screen.getByLabelText('Número de tarjeta')).toBeDisabled();
    expect(screen.getByLabelText('Vencimiento')).toBeDisabled();
    expect(screen.getByLabelText('CVV')).toBeDisabled();
    expect(screen.getByLabelText('Nombre en la tarjeta')).toBeDisabled();
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('shows processing text when isProcessing is true', () => {
    render(<CardPaymentForm {...defaultProps} isProcessing={true} />);
    expect(screen.getByText('Procesando pago...')).toBeInTheDocument();
  });

  it('disables all inputs when disabled prop is true', () => {
    render(<CardPaymentForm {...defaultProps} disabled={true} />);

    expect(screen.getByLabelText('Número de tarjeta')).toBeDisabled();
    expect(screen.getByLabelText('Vencimiento')).toBeDisabled();
    expect(screen.getByLabelText('CVV')).toBeDisabled();
    expect(screen.getByLabelText('Nombre en la tarjeta')).toBeDisabled();
  });

  it('shows auto-renewal notice', () => {
    render(<CardPaymentForm {...defaultProps} />);
    expect(screen.getByText('Tu tarjeta será guardada para renovaciones automáticas')).toBeInTheDocument();
  });

  it('formats empty card number to empty string', async () => {
    const user = userEvent.setup();
    render(<CardPaymentForm {...defaultProps} />);

    const input = screen.getByLabelText('Número de tarjeta');
    await user.type(input, 'abc');

    expect(input).toHaveValue('');
  });

  it('shows expired error for card in current year but past month', async () => {
    const user = userEvent.setup();
    render(<CardPaymentForm {...defaultProps} />);

    const now = new Date();
    const currentYear = (now.getFullYear() % 100).toString().padStart(2, '0');
    const pastMonth = '01';

    await user.type(screen.getByLabelText('Número de tarjeta'), '4111111111111111');
    await user.type(screen.getByLabelText('Vencimiento'), `${pastMonth}${currentYear}`);
    await user.type(screen.getByLabelText('CVV'), '123');
    await user.type(screen.getByLabelText('Nombre en la tarjeta'), 'JUAN PEREZ');
    await user.click(screen.getByRole('button', { name: `Pagar ${defaultProps.amount}` }));

    expect(screen.getByText('Tarjeta vencida')).toBeInTheDocument();
  });

  it('shows expiry error only after field is touched and submit attempted', async () => {
    const user = userEvent.setup();
    render(<CardPaymentForm {...defaultProps} />);

    expect(screen.queryByText('Fecha inválida')).not.toBeInTheDocument();

    await user.click(screen.getByLabelText('Vencimiento'));
    await user.tab();
    await user.click(screen.getByRole('button', { name: `Pagar ${defaultProps.amount}` }));

    expect(screen.getByText('Fecha inválida')).toBeInTheDocument();
  });
});
