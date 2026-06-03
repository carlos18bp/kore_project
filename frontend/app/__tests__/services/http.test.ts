import type { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';

jest.mock('js-cookie', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    set: jest.fn(),
    remove: jest.fn(),
  },
}));

describe('http service — baseURL', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('creates axios instance with default baseURL', async () => {
    delete process.env.NEXT_PUBLIC_API_BASE_URL;
    const { api } = await import('@/lib/services/http');
    expect(api.defaults.baseURL).toBe('/api');
  });

  it('uses direct backend API fallback in development', async () => {
    delete process.env.NEXT_PUBLIC_API_BASE_URL;
    process.env = { ...process.env, NODE_ENV: 'development' };
    const { api } = await import('@/lib/services/http');
    expect(api.defaults.baseURL).toBe('http://localhost:8000/api');
  });

  it('uses NEXT_PUBLIC_API_BASE_URL env variable when set', async () => {
    process.env.NEXT_PUBLIC_API_BASE_URL = 'https://api.kore.co';
    const { api } = await import('@/lib/services/http');
    expect(api.defaults.baseURL).toBe('https://api.kore.co');
  });
});

describe('http service — interceptors', () => {
  let api: AxiosInstance;
  let Cookies: { get: jest.Mock; set: jest.Mock; remove: jest.Mock };
  let capturedConfig: AxiosRequestConfig | null;
  let nextResponse: (config: AxiosRequestConfig) => Promise<AxiosResponse>;

  beforeEach(async () => {
    jest.resetModules();
    capturedConfig = null;
    // Default adapter: echo a 200 response and remember the outgoing config.
    nextResponse = async (config: AxiosRequestConfig) => {
      capturedConfig = config;
      return {
        data: {},
        status: 200,
        statusText: 'OK',
        headers: {},
        config,
      } as AxiosResponse;
    };

    Cookies = (await import('js-cookie')).default as unknown as {
      get: jest.Mock; set: jest.Mock; remove: jest.Mock;
    };
    Cookies.get.mockReset();
    Cookies.set.mockReset();
    Cookies.remove.mockReset();

    api = (await import('@/lib/services/http')).api;
    // Inject a custom adapter so requests don't hit the network.
    api.defaults.adapter = (config) => nextResponse(config);
  });

  describe('request interceptor', () => {
    it('injects Authorization: Bearer <kore_token> when the cookie is set', async () => {
      Cookies.get.mockImplementation((key: string) => (key === 'kore_token' ? 'tok-abc' : undefined));

      await api.get('/whoami');

      expect(capturedConfig).not.toBeNull();
      const auth = capturedConfig!.headers!.Authorization
        ?? (capturedConfig!.headers as unknown as { get?: (k: string) => string }).get?.('Authorization');
      expect(auth).toBe('Bearer tok-abc');
    });

    it('does not set Authorization when the kore_token cookie is missing', async () => {
      Cookies.get.mockReturnValue(undefined);

      await api.get('/public-thing');

      const headers = capturedConfig!.headers as unknown as {
        Authorization?: string;
        get?: (k: string) => string | undefined;
      };
      const auth = headers.Authorization ?? headers.get?.('Authorization');
      expect(auth).toBeUndefined();
    });

    it('preserves an explicit Authorization header passed by the caller', async () => {
      Cookies.get.mockImplementation((key: string) => (key === 'kore_token' ? 'cookie-token' : undefined));

      await api.get('/whoami', { headers: { Authorization: 'Bearer explicit-token' } });

      const headers = capturedConfig!.headers as unknown as {
        Authorization?: string;
        get?: (k: string) => string;
      };
      const auth = headers.Authorization ?? headers.get?.('Authorization');
      expect(auth).toBe('Bearer explicit-token');
    });
  });

  describe('response interceptor — 401 handling', () => {
    it('clears auth cookies when a request returns 401', async () => {
      nextResponse = async (config) => {
        return Promise.reject({
          isAxiosError: true,
          name: 'AxiosError',
          message: 'Request failed with status code 401',
          response: {
            data: { detail: 'Token inválido.' },
            status: 401,
            statusText: 'Unauthorized',
            headers: {},
            config,
          },
          config,
          toJSON: () => ({}),
        });
      };

      await expect(api.get('/secured')).rejects.toMatchObject({
        response: { status: 401 },
      });

      expect(Cookies.remove).toHaveBeenCalledWith('kore_token');
      expect(Cookies.remove).toHaveBeenCalledWith('kore_refresh');
      expect(Cookies.remove).toHaveBeenCalledWith('kore_user');
    });

    it('does NOT clear auth cookies on non-401 errors (e.g. 500)', async () => {
      nextResponse = async (config) => {
        return Promise.reject({
          isAxiosError: true,
          name: 'AxiosError',
          message: 'Request failed with status code 500',
          response: {
            data: { detail: 'boom' },
            status: 500,
            statusText: 'Internal Server Error',
            headers: {},
            config,
          },
          config,
          toJSON: () => ({}),
        });
      };

      await expect(api.get('/secured')).rejects.toMatchObject({
        response: { status: 500 },
      });

      expect(Cookies.remove).not.toHaveBeenCalled();
    });
  });
});

describe('http service — extractApiError', () => {
  const FALLBACK = 'No se pudo guardar.';

  async function extract(err: unknown, fallback = FALLBACK) {
    const { extractApiError } = await import('@/lib/services/http');
    return extractApiError(err, fallback);
  }

  it('returns the DRF detail message when present', async () => {
    const msg = await extract({ response: { data: { detail: 'Validation failed.' } } });
    expect(msg).toBe('Validation failed.');
  });

  it('returns the first DRF field-validation error', async () => {
    const msg = await extract({ response: { data: { weight_kg: ['A valid number is required.'] } } });
    expect(msg).toBe('A valid number is required.');
  });

  it('returns a connection message when there is no response (network error)', async () => {
    const msg = await extract({ message: 'Network Error' });
    expect(msg).toContain('No se pudo contactar el servidor');
  });

  it('returns a timeout message when the request was aborted', async () => {
    const msg = await extract({ code: 'ECONNABORTED', message: 'timeout of 60000ms exceeded' });
    expect(msg).toContain('tardó demasiado');
  });

  it('falls back when the body is an HTML error page', async () => {
    const msg = await extract({ response: { data: '<!DOCTYPE html><html>500</html>' } });
    expect(msg).toBe(FALLBACK);
  });

  it('falls back when there is no usable message', async () => {
    const msg = await extract({ response: { data: {} } });
    expect(msg).toBe(FALLBACK);
  });
});
