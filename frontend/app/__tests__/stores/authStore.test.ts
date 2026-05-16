// quality: disable test_too_long (hydration integration test requires full cookie+API mock setup and state verification)
import Cookies from 'js-cookie';
import { useAuthStore, SPLASH_SHOWN_KEY } from '@/lib/stores/authStore';
import { api } from '@/lib/services/http';
import { AxiosError, AxiosHeaders } from 'axios';
import { waitFor } from '@testing-library/react';

jest.mock('js-cookie', () => ({
  get: jest.fn(),
  set: jest.fn(),
  remove: jest.fn(),
}));

jest.mock('@/lib/services/http', () => ({
  api: { post: jest.fn(), get: jest.fn() },
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
    hydrated: false,
    pendingRevalidation: false,
  });
}

describe('authStore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetStore();
    sessionStorage.clear();
  });

  describe('login', () => {
    it('returns success and stores core auth session on valid credentials', async () => {
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
      expect(state.accessToken).toBe('fake-access-token');
    });

    it('stores normalized profile fields and auth cookies on successful login', async () => {
      mockedApi.post.mockResolvedValueOnce({ data: MOCK_LOGIN_RESPONSE });

      await useAuthStore.getState().login('customer10@kore.com', 'ogthsv25');

      const state = useAuthStore.getState();
      expect(state.user!.name).toBe('Customer10 Kore');
      expect(state.user!.first_name).toBe('Customer10');
      expect(state.user!.last_name).toBe('Kore');

      expect(mockedCookies.set).toHaveBeenCalledWith('kore_token', 'fake-access-token', { expires: 7 });
      expect(mockedCookies.set).toHaveBeenCalledWith('kore_refresh', 'fake-refresh-token', { expires: 7 });
      expect(mockedCookies.set).toHaveBeenCalledWith('kore_user', expect.any(String), { expires: 7 });
    });

    it('returns error and does not change state on invalid credentials', async () => {
      const axiosError = new AxiosError('Request failed', '400', undefined, undefined, {
        data: { non_field_errors: ['Credenciales inválidas.'] },
        status: 400,
        statusText: 'Bad Request',
        headers: {},
        config: { headers: new AxiosHeaders() },
      });
      mockedApi.post.mockRejectedValueOnce(axiosError);

      const { login } = useAuthStore.getState();
      const result = await login('wrong@email.com', 'wrong');

      expect(result).toEqual({ success: false, error: 'Credenciales inválidas.' });

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

      useAuthStore.getState().logout();

      const state = useAuthStore.getState();
      expect(state.user).toBeNull();
      expect(state.accessToken).toBeNull();
      expect(state.isAuthenticated).toBe(false);
      expect(mockedCookies.remove).toHaveBeenCalledWith('kore_token');
      expect(mockedCookies.remove).toHaveBeenCalledWith('kore_refresh');
      expect(mockedCookies.remove).toHaveBeenCalledWith('kore_user');
      expect(mockedApi.get).not.toHaveBeenCalled();
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
        data: { email: ['Ya existe una cuenta con este correo.'] },
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
      expect(result).toEqual({ success: false, error: 'Ya existe una cuenta con este correo.' });
    });

    it('returns string error from response data', async () => {
      const axiosError = new AxiosError('fail', '400', undefined, undefined, {
        data: { detail: 'El registro está deshabilitado.' },
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
      expect(result).toEqual({ success: false, error: 'El registro está deshabilitado.' });
    });

    it('returns generic error when no response data', async () => {
      mockedApi.post.mockRejectedValueOnce(new Error('Network Error'));

      const result = await useAuthStore.getState().register({
        email: 'x@kore.com', password: 'p', password_confirm: 'p',
        first_name: 'A', last_name: 'B',
      });
      expect(result).toEqual({ success: false, error: 'Error al registrar la cuenta' });
    });

    it('falls back to generic error for non-string non-array response value', async () => {
      const axiosError = new AxiosError('Request failed', 'ERR_BAD_REQUEST');
      axiosError.response = {
        data: { meta: { code: 500 } },
        status: 400,
        statusText: 'Bad Request',
        headers: {},
        config: { headers: new AxiosHeaders() },
      };
      mockedApi.post.mockRejectedValueOnce(axiosError);

      const result = await useAuthStore.getState().register({
        email: 'x@kore.com', password: 'p', password_confirm: 'p',
        first_name: 'A', last_name: 'B',
      });
      expect(result).toEqual({ success: false, error: 'Error al registrar la cuenta' });
    });
  });

  describe('hydrate', () => {
    it('marks hydrated when already authenticated and skips profile lookup', () => {
      useAuthStore.setState({
        user: {
          id: '22',
          email: 'customer10@kore.com',
          first_name: 'Customer10',
          last_name: 'Kore',
          phone: '',
          role: 'customer',
          name: 'Customer10 Kore',
          profile_completed: false,
          avatar_url: null,
        },
        accessToken: 'token-123',
        isAuthenticated: true,
        hydrated: false,
      });

      useAuthStore.getState().hydrate();

      const state = useAuthStore.getState();
      expect(state.hydrated).toBe(true);
      expect(mockedApi.get).not.toHaveBeenCalled();
    });

    it('returns early without re-running when already hydrated', () => {
      useAuthStore.setState({ hydrated: true });
      useAuthStore.getState().hydrate();
      expect(mockedApi.get).not.toHaveBeenCalled();
      expect(mockedCookies.get).not.toHaveBeenCalled();
    });

    it('restores session from valid cookies after backend profile check', async () => {
      mockedCookies.get.mockImplementation((key: string) => {
        if (key === 'kore_token') return 'some-token';
        if (key === 'kore_user') return JSON.stringify({
          id: '22',
          email: 'customer10@kore.com',
          first_name: 'Customer10',
          last_name: 'Kore',
          phone: '',
          role: 'customer',
          name: 'Customer10 Kore',
        });
        return undefined;
      });

      mockedApi.get.mockResolvedValueOnce({
        data: {
          user: {
            id: 22,
            email: 'customer10@kore.com',
            first_name: 'Customer10',
            last_name: 'Kore',
            phone: '',
            role: 'customer',
          },
        },
      });

      useAuthStore.getState().hydrate();

      await waitFor(() => {
        const state = useAuthStore.getState();
        expect(state.isAuthenticated).toBe(true);
        expect(state.accessToken).toBe('some-token');
        expect(state.user).toEqual({
          id: '22',
          email: 'customer10@kore.com',
          first_name: 'Customer10',
          last_name: 'Kore',
          phone: '',
          role: 'customer',
          name: 'Customer10 Kore',
          profile_completed: false,
          avatar_url: null,
          assigned_trainer: null,
          must_change_password: false,
        });
      });

      expect(mockedApi.get).toHaveBeenCalledWith('/auth/profile/', {
        headers: { Authorization: 'Bearer some-token' },
      });
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
      expect(mockedApi.get).not.toHaveBeenCalled();
    });

    it('does nothing when token exists but user cookie is missing', () => {
      mockedCookies.get.mockImplementation((key: string) => {
        if (key === 'kore_token') return 'some-token';
        return undefined;
      });

      useAuthStore.getState().hydrate();

      const state = useAuthStore.getState();
      expect(state.isAuthenticated).toBe(false);
      expect(mockedApi.get).not.toHaveBeenCalled();
    });

    it('clears stale auth when backend profile validation returns 401', async () => {
      mockedCookies.get.mockImplementation((key: string) => {
        if (key === 'kore_token') return 'stale-token';
        if (key === 'kore_user') {
          return JSON.stringify({
            id: '99',
            email: 'stale@example.com',
            first_name: 'Stale',
            last_name: 'User',
            phone: '',
            role: 'customer',
            name: 'Stale User',
          });
        }
        return undefined;
      });
      const unauthorized = new AxiosError('Unauthorized', '401', undefined, undefined, {
        data: { detail: 'Token inválido.' },
        status: 401,
        statusText: 'Unauthorized',
        headers: {},
        config: { headers: new AxiosHeaders() },
      });
      mockedApi.get.mockRejectedValueOnce(unauthorized);

      useAuthStore.getState().hydrate();

      await waitFor(() => {
        const state = useAuthStore.getState();
        expect(state.isAuthenticated).toBe(false);
        expect(state.user).toBeNull();
        expect(state.accessToken).toBeNull();
        expect(state.hydrated).toBe(true);
      });

      expect(mockedCookies.remove).toHaveBeenCalledWith('kore_token');
      expect(mockedCookies.remove).toHaveBeenCalledWith('kore_refresh');
      expect(mockedCookies.remove).toHaveBeenCalledWith('kore_user');
    });

    it('keeps cached session when /auth/profile/ fails with a 5xx (transient)', async () => {
      mockedCookies.get.mockImplementation((key: string) => {
        if (key === 'kore_token') return 'good-token';
        if (key === 'kore_user') {
          return JSON.stringify({
            id: '22',
            email: 'customer10@kore.com',
            first_name: 'Customer10',
            last_name: 'Kore',
            phone: '',
            role: 'customer',
            name: 'Customer10 Kore',
          });
        }
        return undefined;
      });
      const serverError = new AxiosError('Server Error', '500', undefined, undefined, {
        data: { detail: 'boom' },
        status: 500,
        statusText: 'Internal Server Error',
        headers: {},
        config: { headers: new AxiosHeaders() },
      });
      mockedApi.get.mockRejectedValueOnce(serverError);

      useAuthStore.getState().hydrate();

      // Immediately after hydrate(), the optimistic session is set.
      const optimistic = useAuthStore.getState();
      expect(optimistic.isAuthenticated).toBe(true);
      expect(optimistic.accessToken).toBe('good-token');
      expect(optimistic.user?.email).toBe('customer10@kore.com');
      expect(optimistic.hydrated).toBe(true);

      // After the rejection, the optimistic session must survive — a flaky
      // /auth/profile/ must NOT force a logout.
      await waitFor(() => {
        expect(mockedApi.get).toHaveBeenCalled();
      });
      const after = useAuthStore.getState();
      expect(after.isAuthenticated).toBe(true);
      expect(after.user?.email).toBe('customer10@kore.com');
      expect(mockedCookies.remove).not.toHaveBeenCalled();
    });

    it('keeps cached session when /auth/profile/ fails with a network error (no response)', async () => {
      mockedCookies.get.mockImplementation((key: string) => {
        if (key === 'kore_token') return 'good-token';
        if (key === 'kore_user') {
          return JSON.stringify({
            id: '22',
            email: 'customer10@kore.com',
            first_name: 'Customer10',
            last_name: 'Kore',
            phone: '',
            role: 'customer',
            name: 'Customer10 Kore',
          });
        }
        return undefined;
      });
      mockedApi.get.mockRejectedValueOnce(new Error('Network Error'));

      useAuthStore.getState().hydrate();

      await waitFor(() => {
        expect(mockedApi.get).toHaveBeenCalled();
      });

      const after = useAuthStore.getState();
      expect(after.isAuthenticated).toBe(true);
      expect(after.user?.email).toBe('customer10@kore.com');
      expect(mockedCookies.remove).not.toHaveBeenCalled();
    });
  });

  describe('clearJustLoggedIn', () => {
    it('clears justLoggedIn state', () => {
      useAuthStore.setState({ justLoggedIn: true });

      useAuthStore.getState().clearJustLoggedIn();

      expect(useAuthStore.getState().justLoggedIn).toBe(false);
    });
  });

  describe('splash session flag', () => {
    it('login clears the splash-shown flag so the next gate replays the animation', async () => {
      sessionStorage.setItem(SPLASH_SHOWN_KEY, '1');
      mockedApi.post.mockResolvedValueOnce({ data: MOCK_LOGIN_RESPONSE });

      await useAuthStore.getState().login('customer10@kore.com', 'ogthsv25');

      expect(sessionStorage.getItem(SPLASH_SHOWN_KEY)).toBeNull();
    });

    it('register clears the splash-shown flag', async () => {
      sessionStorage.setItem(SPLASH_SHOWN_KEY, '1');
      mockedApi.post.mockResolvedValueOnce({ data: MOCK_LOGIN_RESPONSE });

      await useAuthStore.getState().register({
        email: 'customer10@kore.com',
        password: 'pass123',
        password_confirm: 'pass123',
        first_name: 'Customer10',
        last_name: 'Kore',
      });

      expect(sessionStorage.getItem(SPLASH_SHOWN_KEY)).toBeNull();
    });

    it('logout clears the splash-shown flag', async () => {
      sessionStorage.setItem(SPLASH_SHOWN_KEY, '1');

      useAuthStore.getState().logout();

      expect(sessionStorage.getItem(SPLASH_SHOWN_KEY)).toBeNull();
    });

    it('login leaves hydrated=true so the layout gate does not re-block on the splash', async () => {
      mockedApi.post.mockResolvedValueOnce({ data: MOCK_LOGIN_RESPONSE });

      await useAuthStore.getState().login('customer10@kore.com', 'ogthsv25');

      expect(useAuthStore.getState().hydrated).toBe(true);
      expect(useAuthStore.getState().pendingRevalidation).toBe(false);
    });
  });

  describe('hydrate backend revalidation', () => {
    it('fires /auth/profile/ when state was populated from cookies at init (pendingRevalidation=true)', async () => {
      useAuthStore.setState({
        user: {
          id: '22',
          email: 'customer10@kore.com',
          first_name: 'Customer10',
          last_name: 'Kore',
          phone: '',
          role: 'customer',
          name: 'Customer10 Kore',
          profile_completed: false,
          avatar_url: null,
          must_change_password: false,
          assigned_trainer: null,
        },
        accessToken: 'cookie-token',
        isAuthenticated: true,
        hydrated: true,
        pendingRevalidation: true,
      });
      mockedApi.get.mockResolvedValueOnce({
        data: {
          user: {
            id: 22,
            email: 'customer10@kore.com',
            first_name: 'Customer10',
            last_name: 'Kore',
            phone: '',
            role: 'customer',
          },
        },
      });

      useAuthStore.getState().hydrate();

      expect(mockedApi.get).toHaveBeenCalledWith('/auth/profile/', {
        headers: { Authorization: 'Bearer cookie-token' },
      });
      expect(useAuthStore.getState().pendingRevalidation).toBe(false);
    });

    it('does not double-fire /auth/profile/ when hydrate is called twice with pendingRevalidation=true', () => {
      useAuthStore.setState({
        user: {
          id: '22',
          email: 'customer10@kore.com',
          first_name: 'Customer10',
          last_name: 'Kore',
          phone: '',
          role: 'customer',
          name: 'Customer10 Kore',
          profile_completed: false,
          avatar_url: null,
          must_change_password: false,
          assigned_trainer: null,
        },
        accessToken: 'cookie-token',
        isAuthenticated: true,
        hydrated: true,
        pendingRevalidation: true,
      });
      mockedApi.get.mockResolvedValue({ data: { user: {
        id: 22, email: 'x@kore.com', first_name: 'X', last_name: 'Y', phone: '', role: 'customer',
      } } });

      useAuthStore.getState().hydrate();
      useAuthStore.getState().hydrate();

      expect(mockedApi.get).toHaveBeenCalledTimes(1);
    });
  });

  describe('initial state from cookies', () => {
    it('loads user, accessToken, hydrated=true, and pendingRevalidation=true when cookies are present at module load', () => {
      mockedCookies.get.mockImplementation((key: string) => {
        if (key === 'kore_token') return 'cached-token';
        if (key === 'kore_user') {
          return JSON.stringify({
            id: '22',
            email: 'customer10@kore.com',
            first_name: 'Customer10',
            last_name: 'Kore',
            phone: '',
            role: 'customer',
            name: 'Customer10 Kore',
          });
        }
        return undefined;
      });

      jest.isolateModules(() => {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { useAuthStore: freshStore } = require('@/lib/stores/authStore');
        const state = freshStore.getState();
        expect(state.hydrated).toBe(true);
        expect(state.isAuthenticated).toBe(true);
        expect(state.accessToken).toBe('cached-token');
        expect(state.user?.email).toBe('customer10@kore.com');
        expect(state.pendingRevalidation).toBe(true);
      });
    });

    it('falls back to empty unauthenticated state when cookies are absent at module load', () => {
      mockedCookies.get.mockReturnValue(undefined);

      jest.isolateModules(() => {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { useAuthStore: freshStore } = require('@/lib/stores/authStore');
        const state = freshStore.getState();
        expect(state.hydrated).toBe(false);
        expect(state.isAuthenticated).toBe(false);
        expect(state.user).toBeNull();
        expect(state.accessToken).toBeNull();
      });
    });

    it('falls back to empty state when kore_user cookie is corrupted JSON at module load', () => {
      mockedCookies.get.mockImplementation((key: string) => {
        if (key === 'kore_token') return 'some-token';
        if (key === 'kore_user') return '{not-json';
        return undefined;
      });

      jest.isolateModules(() => {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { useAuthStore: freshStore } = require('@/lib/stores/authStore');
        const state = freshStore.getState();
        expect(state.hydrated).toBe(false);
        expect(state.isAuthenticated).toBe(false);
        expect(state.user).toBeNull();
        expect(state.accessToken).toBeNull();
      });
    });
  });
});
