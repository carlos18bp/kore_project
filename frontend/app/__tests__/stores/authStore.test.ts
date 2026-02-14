import Cookies from 'js-cookie';
import { useAuthStore } from '@/lib/stores/authStore';
import { api } from '@/lib/services/http';
import { AxiosError, AxiosHeaders } from 'axios';

jest.mock('js-cookie', () => ({
  get: jest.fn(),
  set: jest.fn(),
  remove: jest.fn(),
}));

jest.mock('@/lib/services/http', () => ({
  api: { post: jest.fn() },
}));

const mockedCookies = Cookies as jest.Mocked<typeof Cookies>;
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

function resetStore() {
  useAuthStore.setState({
    user: null,
    accessToken: null,
    isAuthenticated: false,
  });
}

describe('authStore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetStore();
  });

  describe('login', () => {
    it('sets user, token and cookies on valid credentials', async () => {
      mockedApi.post.mockResolvedValueOnce({ data: MOCK_LOGIN_RESPONSE });

      const { login } = useAuthStore.getState();
      const result = await login('customer10@kore.com', 'ogthsv25');

      expect(result).toEqual({ success: true });
      expect(mockedApi.post).toHaveBeenCalledWith('/auth/login/', {
        email: 'customer10@kore.com',
        password: 'ogthsv25',
      });

      const state = useAuthStore.getState();
      expect(state.isAuthenticated).toBe(true);
      expect(state.user).not.toBeNull();
      expect(state.user!.email).toBe('customer10@kore.com');
      expect(state.user!.name).toBe('Customer10 Kore');
      expect(state.user!.first_name).toBe('Customer10');
      expect(state.user!.last_name).toBe('Kore');
      expect(state.accessToken).toBe('fake-access-token');

      expect(mockedCookies.set).toHaveBeenCalledWith('kore_token', 'fake-access-token', { expires: 7 });
      expect(mockedCookies.set).toHaveBeenCalledWith('kore_refresh', 'fake-refresh-token', { expires: 7 });
      expect(mockedCookies.set).toHaveBeenCalledWith('kore_user', expect.any(String), { expires: 7 });
    });

    it('returns error and does not change state on invalid credentials', async () => {
      const axiosError = new AxiosError('Request failed', '400', undefined, undefined, {
        data: { non_field_errors: ['Invalid credentials.'] },
        status: 400,
        statusText: 'Bad Request',
        headers: {},
        config: { headers: new AxiosHeaders() },
      });
      mockedApi.post.mockRejectedValueOnce(axiosError);

      const { login } = useAuthStore.getState();
      const result = await login('wrong@email.com', 'wrong');

      expect(result).toEqual({ success: false, error: 'Invalid credentials.' });

      const state = useAuthStore.getState();
      expect(state.isAuthenticated).toBe(false);
      expect(state.user).toBeNull();
      expect(state.accessToken).toBeNull();
      expect(mockedCookies.set).not.toHaveBeenCalled();
    });

    it('falls back to email for user name when first/last names are empty', async () => {
      const response = {
        user: { id: 99, email: 'noname@kore.com', first_name: '', last_name: '', phone: '', role: 'customer' },
        tokens: { access: 'tok', refresh: 'ref' },
      };
      mockedApi.post.mockResolvedValueOnce({ data: response });

      const result = await useAuthStore.getState().login('noname@kore.com', 'pass');
      expect(result).toEqual({ success: true });
      const state = useAuthStore.getState();
      expect(state.user!.name).toBe('noname@kore.com');
      expect(state.user!.first_name).toBe('');
      expect(state.user!.last_name).toBe('');
    });

    it('returns generic error message when API returns no detail', async () => {
      mockedApi.post.mockRejectedValueOnce(new Error('Network Error'));

      const { login } = useAuthStore.getState();
      const result = await login('customer10@kore.com', 'wrongpass');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Correo o contraseña incorrectos');
    });
  });

  describe('logout', () => {
    it('clears user, token, cookies and resets isAuthenticated', async () => {
      mockedApi.post.mockResolvedValueOnce({ data: MOCK_LOGIN_RESPONSE });

      const { login } = useAuthStore.getState();
      await login('customer10@kore.com', 'ogthsv25');
      expect(useAuthStore.getState().isAuthenticated).toBe(true);

      useAuthStore.getState().logout();

      const state = useAuthStore.getState();
      expect(state.user).toBeNull();
      expect(state.accessToken).toBeNull();
      expect(state.isAuthenticated).toBe(false);
      expect(mockedCookies.remove).toHaveBeenCalledWith('kore_token');
      expect(mockedCookies.remove).toHaveBeenCalledWith('kore_refresh');
      expect(mockedCookies.remove).toHaveBeenCalledWith('kore_user');
    });
  });

  describe('register', () => {
    it('sets user, token and cookies on successful registration', async () => {
      mockedApi.post.mockResolvedValueOnce({ data: MOCK_LOGIN_RESPONSE });

      const { register } = useAuthStore.getState();
      const result = await register({
        email: 'customer10@kore.com',
        password: 'pass123',
        password_confirm: 'pass123',
        first_name: 'Customer10',
        last_name: 'Kore',
      });

      expect(result).toEqual({ success: true });
      const state = useAuthStore.getState();
      expect(state.isAuthenticated).toBe(true);
      expect(state.user!.email).toBe('customer10@kore.com');
      expect(mockedCookies.set).toHaveBeenCalledWith('kore_token', 'fake-access-token', { expires: 7 });
    });

    it('returns first array error from response data', async () => {
      const axiosError = new AxiosError('fail', '400', undefined, undefined, {
        data: { email: ['Email already exists.'] },
        status: 400,
        statusText: 'Bad Request',
        headers: {},
        config: { headers: new AxiosHeaders() },
      });
      mockedApi.post.mockRejectedValueOnce(axiosError);

      const result = await useAuthStore.getState().register({
        email: 'dup@kore.com', password: 'p', password_confirm: 'p',
        first_name: 'A', last_name: 'B',
      });
      expect(result).toEqual({ success: false, error: 'Email already exists.' });
    });

    it('returns string error from response data', async () => {
      const axiosError = new AxiosError('fail', '400', undefined, undefined, {
        data: { detail: 'Registration disabled.' },
        status: 400,
        statusText: 'Bad Request',
        headers: {},
        config: { headers: new AxiosHeaders() },
      });
      mockedApi.post.mockRejectedValueOnce(axiosError);

      const result = await useAuthStore.getState().register({
        email: 'x@kore.com', password: 'p', password_confirm: 'p',
        first_name: 'A', last_name: 'B',
      });
      expect(result).toEqual({ success: false, error: 'Registration disabled.' });
    });

    it('returns generic error when no response data', async () => {
      mockedApi.post.mockRejectedValueOnce(new Error('Network Error'));

      const result = await useAuthStore.getState().register({
        email: 'x@kore.com', password: 'p', password_confirm: 'p',
        first_name: 'A', last_name: 'B',
      });
      expect(result).toEqual({ success: false, error: 'Error al registrar la cuenta' });
    });
  });

  describe('hydrate', () => {
    it('restores session from valid cookies', () => {
      const mockUser = {
        id: '22',
        email: 'customer10@kore.com',
        first_name: 'Customer10',
        last_name: 'Kore',
        phone: '',
        role: 'customer',
        name: 'Customer10 Kore',
      };
      mockedCookies.get.mockImplementation((key: string) => {
        if (key === 'kore_token') return 'some-token';
        if (key === 'kore_user') return JSON.stringify(mockUser);
        return undefined;
      });

      useAuthStore.getState().hydrate();

      const state = useAuthStore.getState();
      expect(state.isAuthenticated).toBe(true);
      expect(state.accessToken).toBe('some-token');
      expect(state.user).toEqual(mockUser);
    });

    it('clears cookies when user JSON is corrupted', () => {
      mockedCookies.get.mockImplementation((key: string) => {
        if (key === 'kore_token') return 'some-token';
        if (key === 'kore_user') return '{invalid-json';
        return undefined;
      });

      useAuthStore.getState().hydrate();

      const state = useAuthStore.getState();
      expect(state.isAuthenticated).toBe(false);
      expect(mockedCookies.remove).toHaveBeenCalledWith('kore_token');
      expect(mockedCookies.remove).toHaveBeenCalledWith('kore_refresh');
      expect(mockedCookies.remove).toHaveBeenCalledWith('kore_user');
    });

    it('does nothing when no cookies are present', () => {
      mockedCookies.get.mockReturnValue(undefined);

      useAuthStore.getState().hydrate();

      const state = useAuthStore.getState();
      expect(state.isAuthenticated).toBe(false);
      expect(state.user).toBeNull();
    });

    it('does nothing when token exists but user cookie is missing', () => {
      mockedCookies.get.mockImplementation((key: string) => {
        if (key === 'kore_token') return 'some-token';
        return undefined;
      });

      useAuthStore.getState().hydrate();

      const state = useAuthStore.getState();
      expect(state.isAuthenticated).toBe(false);
    });
  });
});
