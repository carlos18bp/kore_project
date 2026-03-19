import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import PasswordResetModal from '@/app/components/profile/PasswordResetModal';
import { api } from '@/lib/services/http';

jest.mock('@/lib/services/http', () => ({
  api: { get: jest.fn(), post: jest.fn() },
}));

const mockedApi = api as jest.Mocked<typeof api>;

function fillCode(value: string) {
  const input = screen.getByPlaceholderText('000000');
  fireEvent.change(input, { target: { value } });
  return input;
}

async function goToStep2() {
  mockedApi.post.mockResolvedValueOnce({ data: { reset_token: 'tok-123' } } as never);
  const input = fillCode('123456');
  await act(async () => { fireEvent.submit(input.closest('form')!); });
  await waitFor(() => {
    expect(screen.getByRole('heading', { name: /Nueva contraseña/i })).toBeInTheDocument();
  });
}

function fillPasswords(newPwd: string, confirmPwd: string) {
  const newInput = screen.getByPlaceholderText('Mínimo 8 caracteres');
  const confirmInput = screen.getByPlaceholderText('Repite tu contraseña');
  fireEvent.change(newInput, { target: { value: newPwd } });
  fireEvent.change(confirmInput, { target: { value: confirmPwd } });
  return newInput;
}

describe('PasswordResetModal', () => {
  const defaultProps = { email: 'user@test.com', onClose: jest.fn() };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders step 1 (code verification) by default', () => {
    render(<PasswordResetModal {...defaultProps} />);

    expect(screen.getByText('Ingresa el código')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('000000')).toBeInTheDocument();
    expect(screen.getByText(/Enviado a/)).toBeInTheDocument();
    expect(screen.getByText('user@test.com')).toBeInTheDocument();
  });

  it('disables verify button when code is less than 6 digits', () => {
    render(<PasswordResetModal {...defaultProps} />);

    const submitBtn = screen.getByRole('button', { name: /Verificar código/i });
    expect(submitBtn).toBeDisabled();
  });

  it('calls onClose when backdrop is clicked', () => {
    render(<PasswordResetModal {...defaultProps} />);

    const backdrop = document.querySelector('.bg-black\\/40');
    if (backdrop) fireEvent.click(backdrop);

    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('calls onClose when close button is clicked', () => {
    render(<PasswordResetModal {...defaultProps} />);

    const closeButtons = screen.getAllByRole('button');
    const closeBtn = closeButtons.find(btn => btn.querySelector('svg'));
    if (closeBtn) fireEvent.click(closeBtn);

    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('transitions to step 2 after successful code verification', async () => {
    render(<PasswordResetModal {...defaultProps} />);
    await goToStep2();

    expect(screen.getByRole('heading', { name: /Nueva contraseña/i })).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Mínimo 8 caracteres')).toBeInTheDocument();
  });

  it('shows error on invalid code', async () => {
    mockedApi.post.mockRejectedValueOnce(new Error('invalid'));

    render(<PasswordResetModal {...defaultProps} />);

    const input = fillCode('999999');
    await act(async () => { fireEvent.submit(input.closest('form')!); });

    await waitFor(() => {
      expect(screen.getByText('Código inválido o expirado.')).toBeInTheDocument();
    });
  });

  it('resends code when resend button is clicked', async () => {
    mockedApi.post.mockResolvedValueOnce({ data: {} } as never);

    render(<PasswordResetModal {...defaultProps} />);

    const resendBtn = screen.getByRole('button', { name: /Reenviar código/i });
    await act(async () => { fireEvent.click(resendBtn); });

    await waitFor(() => {
      expect(mockedApi.post).toHaveBeenCalledWith(
        '/auth/password-reset/request-code/',
        { email: 'user@test.com' },
      );
    });
  });

  it('shows error when resend code fails', async () => {
    mockedApi.post.mockRejectedValueOnce(new Error('fail'));

    render(<PasswordResetModal {...defaultProps} />);

    const resendBtn = screen.getByRole('button', { name: /Reenviar código/i });
    await act(async () => { fireEvent.click(resendBtn); });

    await waitFor(() => {
      expect(screen.getByText('Error al reenviar el código.')).toBeInTheDocument();
    });
  });

  it('shows error when passwords do not match', async () => {
    render(<PasswordResetModal {...defaultProps} />);
    await goToStep2();

    const newInput = fillPasswords('password123', 'differentpw');
    await act(async () => { fireEvent.submit(newInput.closest('form')!); });

    await waitFor(() => {
      expect(screen.getByText('Las contraseñas no coinciden.')).toBeInTheDocument();
    });
  });

  it('shows error when password is too short', async () => {
    render(<PasswordResetModal {...defaultProps} />);
    await goToStep2();

    const newInput = fillPasswords('short', 'short');
    await act(async () => { fireEvent.submit(newInput.closest('form')!); });

    await waitFor(() => {
      expect(screen.getByText('La contraseña debe tener al menos 8 caracteres.')).toBeInTheDocument();
    });
  });

  it('resets password successfully and calls onClose', async () => {
    jest.useFakeTimers();

    render(<PasswordResetModal {...defaultProps} />);
    await goToStep2();

    mockedApi.post.mockResolvedValueOnce({ data: {} } as never);
    const newInput = fillPasswords('newpass123', 'newpass123');
    await act(async () => { fireEvent.submit(newInput.closest('form')!); });

    await waitFor(() => {
      expect(screen.getByText('¡Contraseña actualizada correctamente!')).toBeInTheDocument();
    });

    act(() => { jest.advanceTimersByTime(2000); });
    expect(defaultProps.onClose).toHaveBeenCalled();

    jest.useRealTimers();
  });

  it('shows API error detail on password reset failure', async () => {
    render(<PasswordResetModal {...defaultProps} />);
    await goToStep2();

    mockedApi.post.mockRejectedValueOnce({
      response: { data: { detail: 'Token expirado.' } },
    });
    const newInput = fillPasswords('newpass123', 'newpass123');
    await act(async () => { fireEvent.submit(newInput.closest('form')!); });

    await waitFor(() => {
      expect(screen.getByText('Token expirado.')).toBeInTheDocument();
    });
  });

  it('shows API error detail array on password reset failure', async () => {
    render(<PasswordResetModal {...defaultProps} />);
    await goToStep2();

    mockedApi.post.mockRejectedValueOnce({
      response: { data: { detail: ['Error 1.', 'Error 2.'] } },
    });
    const newInput = fillPasswords('newpass123', 'newpass123');
    await act(async () => { fireEvent.submit(newInput.closest('form')!); });

    await waitFor(() => {
      expect(screen.getByText('Error 1. Error 2.')).toBeInTheDocument();
    });
  });

  it('shows generic error when no detail in API response', async () => {
    render(<PasswordResetModal {...defaultProps} />);
    await goToStep2();

    mockedApi.post.mockRejectedValueOnce({ response: { data: {} } });
    const newInput = fillPasswords('newpass123', 'newpass123');
    await act(async () => { fireEvent.submit(newInput.closest('form')!); });

    await waitFor(() => {
      expect(screen.getByText('Error al cambiar la contraseña.')).toBeInTheDocument();
    });
  });

  it('toggles password visibility', async () => {
    render(<PasswordResetModal {...defaultProps} />);
    await goToStep2();

    const toggleBtn = screen.getByRole('button', { name: /Ver/i });
    const pwdInput = screen.getByPlaceholderText('Mínimo 8 caracteres');

    expect(pwdInput).toHaveAttribute('type', 'password');
    fireEvent.click(toggleBtn);
    expect(pwdInput).toHaveAttribute('type', 'text');
  });
});
