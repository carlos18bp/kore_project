import { render, screen, fireEvent } from '@testing-library/react';
import PaymentMethodSelector from '@/app/components/checkout/PaymentMethodSelector';

jest.mock('next/image', () => ({
  __esModule: true,
  default: (props: React.ImgHTMLAttributes<HTMLImageElement> & { onError?: (e: unknown) => void }) => {
    const { onError, ...rest } = props;
    return <img {...rest} data-testid={`img-${props.alt}`} onError={onError as React.ReactEventHandler<HTMLImageElement>} />;
  },
}));

describe('PaymentMethodSelector', () => {
  const defaultProps = {
    selectedMethod: null as null,
    onSelectMethod: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the three Wompi-aligned recurring methods (CARD, NEQUI, BANCOLOMBIA)', () => {
    render(<PaymentMethodSelector {...defaultProps} />);

    expect(screen.getByText('Tarjeta')).toBeInTheDocument();
    expect(screen.getByText('Nequi')).toBeInTheDocument();
    expect(screen.getByText('Bancolombia')).toBeInTheDocument();
  });

  it('does not render PSE — Wompi does not support PSE as a recurring source', () => {
    render(<PaymentMethodSelector {...defaultProps} />);
    expect(screen.queryByText('PSE')).not.toBeInTheDocument();
  });

  it('renders section heading', () => {
    render(<PaymentMethodSelector {...defaultProps} />);
    expect(screen.getByText('Elige tu método de pago')).toBeInTheDocument();
  });

  it('renders descriptions for each visible method', () => {
    render(<PaymentMethodSelector {...defaultProps} />);

    expect(screen.getByText('Crédito o débito')).toBeInTheDocument();
    expect(screen.getByText('Pago desde tu app')).toBeInTheDocument();
    expect(screen.getByText('Transferencia')).toBeInTheDocument();
  });

  it('shows an Auto badge on every recurring method (all 3 visible methods)', () => {
    render(<PaymentMethodSelector {...defaultProps} />);
    expect(screen.getAllByText('Auto')).toHaveLength(3);
  });

  it('calls onSelectMethod when a payment method is clicked', () => {
    render(<PaymentMethodSelector {...defaultProps} />);
    fireEvent.click(screen.getByText('Nequi').closest('button')!);
    expect(defaultProps.onSelectMethod).toHaveBeenCalledWith('nequi');
  });

  it('calls onSelectMethod with card when Tarjeta is clicked', () => {
    render(<PaymentMethodSelector {...defaultProps} />);
    fireEvent.click(screen.getByText('Tarjeta').closest('button')!);
    expect(defaultProps.onSelectMethod).toHaveBeenCalledWith('card');
  });

  it('shows the card-specific recurring note when card is selected', () => {
    render(<PaymentMethodSelector {...defaultProps} selectedMethod="card" />);
    expect(screen.getByText(/Renovación automática cada mes/)).toBeInTheDocument();
  });

  it('shows the Nequi-specific note (mentioning the app approval) when nequi is selected', () => {
    render(<PaymentMethodSelector {...defaultProps} selectedMethod="nequi" />);
    expect(screen.getByText(/app Nequi/)).toBeInTheDocument();
  });

  it('shows the Bancolombia-specific note (one-time authorization) when bancolombia is selected', () => {
    render(<PaymentMethodSelector {...defaultProps} selectedMethod="bancolombia" />);
    expect(screen.getByText(/autorización inicial/)).toBeInTheDocument();
  });

  it('does not show renewal text when no method is selected', () => {
    render(<PaymentMethodSelector {...defaultProps} selectedMethod={null} />);
    expect(screen.queryByText(/Renovación/)).not.toBeInTheDocument();
  });

  it('disables all buttons when disabled prop is true', () => {
    render(<PaymentMethodSelector {...defaultProps} disabled={true} />);

    const buttons = screen.getAllByRole('button');
    buttons.forEach((button) => {
      expect(button).toBeDisabled();
    });
  });

  it('hides image on error', () => {
    render(<PaymentMethodSelector {...defaultProps} />);

    const img = screen.getByTestId('img-Tarjeta');
    fireEvent.error(img);

    expect(img).toHaveStyle('display: none');
  });

  it('renders images for each visible payment method', () => {
    render(<PaymentMethodSelector {...defaultProps} />);

    expect(screen.getByTestId('img-Tarjeta')).toBeInTheDocument();
    expect(screen.getByTestId('img-Nequi')).toBeInTheDocument();
    expect(screen.getByTestId('img-Bancolombia')).toBeInTheDocument();
    expect(screen.queryByTestId('img-PSE')).not.toBeInTheDocument();
  });
});
