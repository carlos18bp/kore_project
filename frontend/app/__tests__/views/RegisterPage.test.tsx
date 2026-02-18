import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import RegisterPage from '@/app/(public)/register/page';
import { useAuthStore } from '@/lib/stores/authStore';
import { api } from '@/lib/services/http';
import { AxiosError, AxiosHeaders } from 'axios';

const mockPush = jest.fn();
const mockGet = jest.fn().mockReturnValue(null);

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  useSearchParams: () => ({
    get: mockGet,
  }),
}));

jest.mock('next/image', () => ({
  __esModule: true,
  default: (props: React.ImgHTMLAttributes<HTMLImageElement>) => <img {...props} />,
}));

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href, ...rest }: { children: React.ReactNode; href: string }) => (
    <a href={href} {...rest}>{children}</a>
  ),
}));

jest.mock('js-cookie', () => ({
  get: jest.fn(),
  set: jest.fn(),
  remove: jest.fn(),
}));

jest.mock('@/lib/services/http', () => ({
  api: { get: jest.fn(), post: jest.fn() },
}));

const mockedApi = api as jest.Mocked<typeof api>;

const MOCK_PRE_REGISTER_RESPONSE = {
  registration_token: 'signed-registration-token-123',
};

jest.setTimeout(15000);

describe('RegisterPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedApi.get.mockReset();
    mockedApi.post.mockReset();
    mockGet.mockReturnValue('5');
    mockedApi.get.mockRejectedValue(new Error('captcha-key-unavailable-in-test'));
    useAuthStore.setState({ user: null, accessToken: null, isAuthenticated: false, hydrated: true });
    window.sessionStorage.clear();
  });

  it('renders the registration form with all fields', () => {
    render(<RegisterPage />);
    expect(screen.getByLabelText(/Nombre/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Apellido/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Correo electrónico/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Teléfono/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Contraseña$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Confirmar contraseña/i)).toBeInTheDocument();
  });

  it('renders the brand name KÓRE', () => {
    render(<RegisterPage />);
    expect(screen.getByText('KÓRE')).toBeInTheDocument();
  });

  it('renders the submit button', () => {
    render(<RegisterPage />);
    expect(screen.getByRole('button', { name: 'Continuar al pago' })).toBeInTheDocument();
  });

  it('renders link to login page', () => {
    render(<RegisterPage />);
    expect(screen.getByText('Inicia sesión')).toBeInTheDocument();
    expect(screen.getByText('Inicia sesión').closest('a')).toHaveAttribute('href', '/login');
  });

  it('shows error when passwords do not match', async () => {
    render(<RegisterPage />);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/Nombre/i), 'Ana');
    await user.type(screen.getByLabelText(/Apellido/i), 'García');
    await user.type(screen.getByLabelText(/Correo electrónico/i), 'new@example.com');
    await user.type(screen.getByLabelText(/^Contraseña$/i), 'password123');
    await user.type(screen.getByLabelText(/Confirmar contraseña/i), 'different123');
    await user.click(screen.getByRole('button', { name: 'Continuar al pago' }));

    expect(screen.getByText('Las contraseñas no coinciden')).toBeInTheDocument();
    expect(mockedApi.post).not.toHaveBeenCalled();
  });

  it('shows error when password is too short', async () => {
    render(<RegisterPage />);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/Nombre/i), 'Ana');
    await user.type(screen.getByLabelText(/Apellido/i), 'García');
    await user.type(screen.getByLabelText(/Correo electrónico/i), 'new@example.com');
    await user.type(screen.getByLabelText(/^Contraseña$/i), 'short');
    await user.type(screen.getByLabelText(/Confirmar contraseña/i), 'short');
    await user.click(screen.getByRole('button', { name: 'Continuar al pago' }));

    expect(screen.getByText('La contraseña debe tener al menos 8 caracteres')).toBeInTheDocument();
  });

  it('stores registration token and redirects to checkout on successful pre-register', async () => {
    mockedApi.post.mockResolvedValueOnce({ data: MOCK_PRE_REGISTER_RESPONSE });

    render(<RegisterPage />);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/Nombre/i), 'Ana');
    await user.type(screen.getByLabelText(/Apellido/i), 'García');
    await user.type(screen.getByLabelText(/Correo electrónico/i), 'new@example.com');
    await user.type(screen.getByLabelText(/^Contraseña$/i), 'password123');
    await user.type(screen.getByLabelText(/Confirmar contraseña/i), 'password123');
    await user.click(screen.getByRole('button', { name: 'Continuar al pago' }));

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/checkout?package=5');
    });

    expect(window.sessionStorage.getItem('kore_checkout_registration_token')).toBe('signed-registration-token-123');
    expect(window.sessionStorage.getItem('kore_checkout_registration_package')).toBe('5');
  });

  it('redirects to programs when package param is missing', async () => {
    mockGet.mockReturnValue(null);
    mockedApi.post.mockResolvedValueOnce({ data: MOCK_PRE_REGISTER_RESPONSE });

    render(<RegisterPage />);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/Nombre/i), 'Ana');
    await user.type(screen.getByLabelText(/Apellido/i), 'García');
    await user.type(screen.getByLabelText(/Correo electrónico/i), 'new@example.com');
    await user.type(screen.getByLabelText(/^Contraseña$/i), 'password123');
    await user.type(screen.getByLabelText(/Confirmar contraseña/i), 'password123');
    await user.click(screen.getByRole('button', { name: 'Continuar al pago' }));

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/programs');
    });

    expect(mockedApi.post).not.toHaveBeenCalled();
  });

  it('redirects to login when email already exists', async () => {
    const axiosError = new AxiosError('Request failed', '400', undefined, undefined, {
      data: { email: ['Ya existe una cuenta con este correo.'] },
      status: 400,
      statusText: 'Bad Request',
      headers: {},
      config: { headers: new AxiosHeaders() },
    });
    mockedApi.post.mockRejectedValueOnce(axiosError);

    render(<RegisterPage />);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/Nombre/i), 'Ana');
    await user.type(screen.getByLabelText(/Apellido/i), 'García');
    await user.type(screen.getByLabelText(/Correo electrónico/i), 'existing@example.com');
    await user.type(screen.getByLabelText(/^Contraseña$/i), 'password123');
    await user.type(screen.getByLabelText(/Confirmar contraseña/i), 'password123');
    await user.click(screen.getByRole('button', { name: 'Continuar al pago' }));

    await waitFor(() => {
      expect(screen.getByText('Ya existe una cuenta con este correo. Redirigiendo a iniciar sesión...')).toBeInTheDocument();
    });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 1100));
    });

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/login');
    });
  });

  it('shows loading spinner during registration', async () => {
    mockedApi.post.mockReturnValueOnce(new Promise(() => {}));

    render(<RegisterPage />);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/Nombre/i), 'Ana');
    await user.type(screen.getByLabelText(/Apellido/i), 'García');
    await user.type(screen.getByLabelText(/Correo electrónico/i), 'new@example.com');
    await user.type(screen.getByLabelText(/^Contraseña$/i), 'password123');
    await user.type(screen.getByLabelText(/Confirmar contraseña/i), 'password123');
    const submitBtn = screen.getByRole('button', { name: 'Continuar al pago' });
    fireEvent.submit(submitBtn.closest('form')!);

    expect(mockedApi.post).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Validando datos...')).toBeInTheDocument();
  });

  it('redirects if already authenticated', () => {
    useAuthStore.setState({
      user: { id: '30', email: 'new@example.com', first_name: 'Ana', last_name: 'García', phone: '', role: 'customer', name: 'Ana García' },
      accessToken: 'token',
      isAuthenticated: true,
      hydrated: true,
    });
    render(<RegisterPage />);
    expect(mockPush).toHaveBeenCalledWith('/checkout?package=5');
  });
});
