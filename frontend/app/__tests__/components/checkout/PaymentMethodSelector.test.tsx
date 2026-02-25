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

  it('renders all four payment methods', () => {
    render(<PaymentMethodSelector {...defaultProps} />);

    expect(screen.getByText('Tarjeta')).toBeInTheDocument();
    expect(screen.getByText('Nequi')).toBeInTheDocument();
    expect(screen.getByText('PSE')).toBeInTheDocument();
    expect(screen.getByText('Bancolombia')).toBeInTheDocument();
  });

  it('renders section heading', () => {
    render(<PaymentMethodSelector {...defaultProps} />);
    expect(screen.getByText('Elige tu método de pago')).toBeInTheDocument();
  });

  it('renders descriptions for each method', () => {
    render(<PaymentMethodSelector {...defaultProps} />);

    expect(screen.getByText('Crédito o débito')).toBeInTheDocument();
    expect(screen.getByText('Pago desde tu app')).toBeInTheDocument();
    expect(screen.getByText('Débito bancario')).toBeInTheDocument();
    expect(screen.getByText('Transferencia')).toBeInTheDocument();
  });

  it('shows Auto badge for card method', () => {
    render(<PaymentMethodSelector {...defaultProps} />);
    expect(screen.getByText('Auto')).toBeInTheDocument();
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

  it('shows recurring text when card is selected', () => {
    render(<PaymentMethodSelector {...defaultProps} selectedMethod="card" />);
    expect(screen.getByText(/Renovación automática cada mes/)).toBeInTheDocument();
  });

  it('shows manual renewal text when non-recurring method is selected', () => {
    render(<PaymentMethodSelector {...defaultProps} selectedMethod="nequi" />);
    expect(screen.getByText(/Renovación manual/)).toBeInTheDocument();
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

  it('renders images for each payment method', () => {
    render(<PaymentMethodSelector {...defaultProps} />);

    expect(screen.getByTestId('img-Tarjeta')).toBeInTheDocument();
    expect(screen.getByTestId('img-Nequi')).toBeInTheDocument();
    expect(screen.getByTestId('img-PSE')).toBeInTheDocument();
    expect(screen.getByTestId('img-Bancolombia')).toBeInTheDocument();
  });
});
