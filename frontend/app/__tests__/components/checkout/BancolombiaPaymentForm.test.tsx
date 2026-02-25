import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import BancolombiaPaymentForm from '@/app/components/checkout/BancolombiaPaymentForm';

describe('BancolombiaPaymentForm', () => {
  const defaultProps = {
    onSubmit: jest.fn().mockResolvedValue(undefined),
    isProcessing: false,
    amount: '$300,000 COP',
    packageTitle: 'Semi Presencial FLW',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders package title and amount in summary', () => {
    render(<BancolombiaPaymentForm {...defaultProps} />);

    expect(screen.getByText('Semi Presencial FLW')).toBeInTheDocument();
    expect(screen.getByText('$300,000 COP')).toBeInTheDocument();
  });

  it('renders redirect informational text', () => {
    render(<BancolombiaPaymentForm {...defaultProps} />);
    expect(screen.getByText(/Serás redirigido a Bancolombia/)).toBeInTheDocument();
  });

  it('renders confirmation checkbox unchecked by default', () => {
    render(<BancolombiaPaymentForm {...defaultProps} />);
    const checkbox = screen.getByRole('checkbox');
    expect(checkbox).not.toBeChecked();
  });

  it('disables submit button when checkbox is not checked', () => {
    render(<BancolombiaPaymentForm {...defaultProps} />);
    expect(screen.getByRole('button', { name: `Pagar ${defaultProps.amount} con Bancolombia` })).toBeDisabled();
  });

  it('enables submit button when checkbox is checked', async () => {
    const user = userEvent.setup();
    render(<BancolombiaPaymentForm {...defaultProps} />);

    await user.click(screen.getByRole('checkbox'));

    expect(screen.getByRole('button', { name: `Pagar ${defaultProps.amount} con Bancolombia` })).toBeEnabled();
  });

  it('calls onSubmit when form is submitted with checkbox checked', async () => {
    const user = userEvent.setup();
    render(<BancolombiaPaymentForm {...defaultProps} />);

    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: `Pagar ${defaultProps.amount} con Bancolombia` }));

    await waitFor(() => {
      expect(defaultProps.onSubmit).toHaveBeenCalledTimes(1);
    });
  });

  it('disables checkbox and button when isProcessing is true', () => {
    render(<BancolombiaPaymentForm {...defaultProps} isProcessing={true} />);

    expect(screen.getByRole('checkbox')).toBeDisabled();
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('shows processing text when isProcessing is true', () => {
    render(<BancolombiaPaymentForm {...defaultProps} isProcessing={true} />);
    expect(screen.getByText('Redirigiendo a Bancolombia...')).toBeInTheDocument();
  });

  it('disables checkbox when disabled prop is true', () => {
    render(<BancolombiaPaymentForm {...defaultProps} disabled={true} />);
    expect(screen.getByRole('checkbox')).toBeDisabled();
  });

  it('renders Bancolombia requirement text', () => {
    render(<BancolombiaPaymentForm {...defaultProps} />);
    expect(screen.getByText(/Necesitas tener una cuenta de ahorros o corriente/)).toBeInTheDocument();
  });

  it('renders confirmation label text', () => {
    render(<BancolombiaPaymentForm {...defaultProps} />);
    expect(screen.getByText(/Confirmo que tengo una cuenta Bancolombia/)).toBeInTheDocument();
  });
});
