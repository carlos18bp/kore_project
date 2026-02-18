import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import LoginPage from '@/app/(public)/login/page';
import { useAuthStore } from '@/lib/stores/authStore';
import { api } from '@/lib/services/http';
import { AxiosError, AxiosHeaders } from 'axios';
import React from 'react';

const mockPush = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

jest.mock('next/image', () => ({
  __esModule: true,
  default: (props: React.ImgHTMLAttributes<HTMLImageElement>) => <img {...props} />,
}));

jest.mock('react-google-recaptcha', () => {
  const ReactLib = require('react');
  return ReactLib.forwardRef(
    (
      { onChange }: { onChange?: (token: string | null) => void },
      ref: React.Ref<{ reset: () => void }>,
    ) => {
      ReactLib.useImperativeHandle(ref, () => ({ reset: () => {} }));
      ReactLib.useEffect(() => {
        onChange?.('test-captcha-token');
      }, [onChange]);
      return <div data-testid="mock-recaptcha" />;
    },
  );
});

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
  api: { post: jest.fn(), get: jest.fn() },
}));

const mockedApi = api as jest.Mocked<typeof api>;

const MOCK_LOGIN_RESPONSE = {
  user: {
    id: 22,
    email: 'customer10@kore.com',
    first_name: 'Customer10',
    last_name: 'Kore',
    phone: '',
    role: 'customer',
  },
  tokens: {
    access: 'fake-access-token',
    refresh: 'fake-refresh-token',
  },
};

const fillLoginForm = async (
  user: ReturnType<typeof userEvent.setup>,
  email: string,
  password: string,
) => {
  await screen.findByTestId('mock-recaptcha');
  await user.type(screen.getByLabelText(/Correo electrónico/i), email);
  await user.type(screen.getByLabelText(/Contraseña/i), password);
};

describe('LoginPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedApi.get.mockResolvedValue({ data: { site_key: 'test-site-key' } });
    useAuthStore.setState({
      user: null,
      accessToken: null,
      isAuthenticated: false,
      hydrated: true,
      justLoggedIn: false,
    });
  });

  it('renders the login form with email and password fields', () => {
    render(<LoginPage />);
    expect(screen.getByLabelText(/Correo electrónico/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Contraseña/i)).toBeInTheDocument();
  });

  it('renders the brand name KÓRE', () => {
    render(<LoginPage />);
    expect(screen.getByText('KÓRE')).toBeInTheDocument();
  });

  it('renders the submit button', () => {
    render(<LoginPage />);
    expect(screen.getByRole('button', { name: 'Iniciar sesión' })).toBeInTheDocument();
  });

  it('toggles password visibility', async () => {
    render(<LoginPage />);
    const user = userEvent.setup();
    const passwordInput = screen.getByLabelText(/Contraseña/i);

    expect(passwordInput).toHaveAttribute('type', 'password');

    await user.click(screen.getByText('Ver'));
    expect(passwordInput).toHaveAttribute('type', 'text');

    await user.click(screen.getByText('Ocultar'));
    expect(passwordInput).toHaveAttribute('type', 'password');
  });

  it('shows error message on failed login', async () => {
    const axiosError = new AxiosError('Request failed', '400', undefined, undefined, {
      data: { non_field_errors: ['Credenciales inválidas.'] },
      status: 400,
      statusText: 'Bad Request',
      headers: {},
      config: { headers: new AxiosHeaders() },
    });
    mockedApi.post.mockRejectedValueOnce(axiosError);

    render(<LoginPage />);
    const user = userEvent.setup();

    await fillLoginForm(user, 'wrong@email.com', 'wrongpass');
    await user.click(screen.getByRole('button', { name: 'Iniciar sesión' }));

    await waitFor(() => {
      expect(screen.getByText('Credenciales inválidas.')).toBeInTheDocument();
    });
  });

  it('redirects to dashboard on successful login', async () => {
    mockedApi.post.mockResolvedValueOnce({ data: MOCK_LOGIN_RESPONSE });

    render(<LoginPage />);
    const user = userEvent.setup();

    await fillLoginForm(user, 'customer10@kore.com', 'ogthsv25');
    await user.click(screen.getByRole('button', { name: 'Iniciar sesión' }));

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/dashboard');
    });
  });

  it('redirects to dashboard if already authenticated', () => {
    useAuthStore.setState({
      user: {
        id: '22',
        email: 'customer10@kore.com',
        first_name: 'Customer10',
        last_name: 'Kore',
        phone: '',
        role: 'customer',
        name: 'Customer10 Kore',
      },
      accessToken: 'token',
      isAuthenticated: true,
      hydrated: true,
    });
    render(<LoginPage />);
    expect(mockPush).toHaveBeenCalledWith('/dashboard');
  });

  it('renders WhatsApp contact link', () => {
    render(<LoginPage />);
    expect(screen.getByText('Contactar por WhatsApp')).toBeInTheDocument();
  });

  it('renders forgot password link', () => {
    render(<LoginPage />);
    expect(screen.getByText('¿Olvidaste tu contraseña? Contáctanos')).toBeInTheDocument();
  });

  it('shows loading spinner during login attempt', async () => {
    // Never-resolving promise to keep the loading state active
    mockedApi.post.mockReturnValueOnce(new Promise(() => {}));

    render(<LoginPage />);
    const user = userEvent.setup();

    await fillLoginForm(user, 'customer10@kore.com', 'ogthsv25');
    await user.click(screen.getByRole('button', { name: 'Iniciar sesión' }));

    // During the pending API call, the button should show "Ingresando..."
    expect(screen.getByText('Ingresando...')).toBeInTheDocument();
  });
});
