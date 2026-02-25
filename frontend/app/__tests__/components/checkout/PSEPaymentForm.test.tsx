import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PSEPaymentForm from '@/app/components/checkout/PSEPaymentForm';

const MOCK_BANKS = [
  { financial_institution_code: '1001', financial_institution_name: 'Banco de Bogotá' },
  { financial_institution_code: '1002', financial_institution_name: 'Bancolombia' },
];

describe('PSEPaymentForm', () => {
  const defaultProps = {
    onSubmit: jest.fn().mockResolvedValue(undefined),
    onFetchBanks: jest.fn().mockResolvedValue(MOCK_BANKS),
    isProcessing: false,
    amount: '$300,000 COP',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows loading spinner while banks are being fetched', () => {
    const neverResolve = jest.fn(() => new Promise<typeof MOCK_BANKS>(() => {}));
    render(<PSEPaymentForm {...defaultProps} onFetchBanks={neverResolve} />);
    expect(screen.getByText('Cargando bancos...')).toBeInTheDocument();
  });

  it('renders form after banks load successfully', async () => {
    render(<PSEPaymentForm {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByLabelText('Banco')).toBeInTheDocument();
    });
    expect(screen.getByText('Banco de Bogotá')).toBeInTheDocument();
    expect(screen.getByText('Bancolombia')).toBeInTheDocument();
  });

  it('shows error when bank fetch fails', async () => {
    const failingFetch = jest.fn().mockRejectedValue(new Error('fetch error'));
    render(<PSEPaymentForm {...defaultProps} onFetchBanks={failingFetch} />);

    await waitFor(() => {
      expect(screen.getByText('No se pudieron cargar los bancos. Intenta de nuevo.')).toBeInTheDocument();
    });
    expect(screen.getByText('Recargar página')).toBeInTheDocument();
  });

  it('renders user type selector with both options', async () => {
    render(<PSEPaymentForm {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Persona Natural')).toBeInTheDocument();
    });
    expect(screen.getByText('Persona Jurídica')).toBeInTheDocument();
  });

  it('renders document type selector', async () => {
    render(<PSEPaymentForm {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByLabelText('Tipo')).toBeInTheDocument();
    });
  });

  it('renders all form fields after banks load', async () => {
    render(<PSEPaymentForm {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByLabelText('Banco')).toBeInTheDocument();
    });
    expect(screen.getByLabelText('Tipo')).toBeInTheDocument();
    expect(screen.getByLabelText('Número de documento')).toBeInTheDocument();
    expect(screen.getByLabelText('Nombre completo')).toBeInTheDocument();
    expect(screen.getByLabelText('Teléfono')).toBeInTheDocument();
  });

  it('shows validation errors when form is submitted empty', async () => {
    const user = userEvent.setup();
    render(<PSEPaymentForm {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByLabelText('Banco')).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: `Pagar ${defaultProps.amount} con PSE` }));

    expect(screen.getByText('Selecciona un banco')).toBeInTheDocument();
    expect(screen.getByText('Documento inválido')).toBeInTheDocument();
    expect(screen.getByText('Nombre requerido')).toBeInTheDocument();
    expect(screen.getByText('Teléfono inválido')).toBeInTheDocument();
    expect(defaultProps.onSubmit).not.toHaveBeenCalled();
  });

  it('calls onSubmit with correctly formatted PSEPaymentData', async () => {
    const user = userEvent.setup();
    render(<PSEPaymentForm {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByLabelText('Banco')).toBeInTheDocument();
    });

    await user.selectOptions(screen.getByLabelText('Banco'), '1001');
    await user.type(screen.getByLabelText('Número de documento'), '1234567890');
    await user.type(screen.getByLabelText('Nombre completo'), 'Juan Pérez');
    await user.type(screen.getByLabelText('Teléfono'), '3001234567');
    await user.click(screen.getByRole('button', { name: `Pagar ${defaultProps.amount} con PSE` }));

    await waitFor(() => {
      expect(defaultProps.onSubmit).toHaveBeenCalledWith({
        financial_institution_code: '1001',
        user_type: 0,
        user_legal_id_type: 'CC',
        user_legal_id: '1234567890',
        full_name: 'Juan Pérez',
        phone_number: '573001234567',
      });
    });
  });

  it('allows switching user type to Persona Jurídica', async () => {
    const user = userEvent.setup();
    render(<PSEPaymentForm {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Persona Jurídica')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Persona Jurídica'));
    await user.selectOptions(screen.getByLabelText('Banco'), '1001');
    await user.type(screen.getByLabelText('Número de documento'), '1234567890');
    await user.type(screen.getByLabelText('Nombre completo'), 'Empresa SAS');
    await user.type(screen.getByLabelText('Teléfono'), '3001234567');
    await user.click(screen.getByRole('button', { name: `Pagar ${defaultProps.amount} con PSE` }));

    await waitFor(() => {
      expect(defaultProps.onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({ user_type: 1 }),
      );
    });
  });

  it('allows changing document type', async () => {
    const user = userEvent.setup();
    render(<PSEPaymentForm {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByLabelText('Tipo')).toBeInTheDocument();
    });

    await user.selectOptions(screen.getByLabelText('Tipo'), 'NIT');
    await user.selectOptions(screen.getByLabelText('Banco'), '1001');
    await user.type(screen.getByLabelText('Número de documento'), '9001234567');
    await user.type(screen.getByLabelText('Nombre completo'), 'Empresa SAS');
    await user.type(screen.getByLabelText('Teléfono'), '3001234567');
    await user.click(screen.getByRole('button', { name: `Pagar ${defaultProps.amount} con PSE` }));

    await waitFor(() => {
      expect(defaultProps.onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({ user_legal_id_type: 'NIT' }),
      );
    });
  });

  it('disables form fields when isProcessing is true', async () => {
    render(<PSEPaymentForm {...defaultProps} isProcessing={true} />);

    await waitFor(() => {
      expect(screen.getByLabelText('Banco')).toBeInTheDocument();
    });

    expect(screen.getByLabelText('Banco')).toBeDisabled();
    expect(screen.getByLabelText('Número de documento')).toBeDisabled();
    expect(screen.getByLabelText('Nombre completo')).toBeDisabled();
    expect(screen.getByLabelText('Teléfono')).toBeDisabled();
    expect(screen.getByRole('button', { name: /Procesando/ })).toBeDisabled();
  });

  it('shows processing text when isProcessing is true', async () => {
    render(<PSEPaymentForm {...defaultProps} isProcessing={true} />);

    await waitFor(() => {
      expect(screen.getByText('Procesando...')).toBeInTheDocument();
    });
  });

  it('disables form fields when disabled prop is true', async () => {
    render(<PSEPaymentForm {...defaultProps} disabled={true} />);

    await waitFor(() => {
      expect(screen.getByLabelText('Banco')).toBeInTheDocument();
    });

    expect(screen.getByLabelText('Banco')).toBeDisabled();
    expect(screen.getByLabelText('Número de documento')).toBeDisabled();
  });

  it('calls window.location.reload when reload button is clicked on bank error', async () => {
    const user = userEvent.setup();
    const reloadMock = jest.fn();
    const originalLocation = window.location;
    Object.defineProperty(window, 'location', {
      writable: true,
      value: { ...originalLocation, reload: reloadMock },
    });

    const failingFetch = jest.fn().mockRejectedValue(new Error('fetch error'));
    render(<PSEPaymentForm {...defaultProps} onFetchBanks={failingFetch} />);

    await waitFor(() => {
      expect(screen.getByText('Recargar página')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Recargar página'));
    expect(reloadMock).toHaveBeenCalled();

    Object.defineProperty(window, 'location', {
      writable: true,
      value: originalLocation,
    });
  });

  it('renders redirect informational text', async () => {
    render(<PSEPaymentForm {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText(/Serás redirigido a tu banco/)).toBeInTheDocument();
    });
  });

  it('strips non-digit characters from document number input', async () => {
    const user = userEvent.setup();
    render(<PSEPaymentForm {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByLabelText('Número de documento')).toBeInTheDocument();
    });

    const input = screen.getByLabelText('Número de documento');
    await user.type(input, '123-456-7890');

    expect(input).toHaveValue('1234567890');
  });

  it('limits phone input to 10 digits', async () => {
    const user = userEvent.setup();
    render(<PSEPaymentForm {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByLabelText('Teléfono')).toBeInTheDocument();
    });

    const input = screen.getByLabelText('Teléfono');
    await user.type(input, '30012345678901');

    expect(input).toHaveValue('3001234567');
  });
});
