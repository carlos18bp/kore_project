/**
 * http service — transparent token refresh on 401.
 *
 * Relocated from `e2e/auth/auth-token-refresh.spec.ts`, which drove this logic
 * through a browser without ever touching the UI (no click/fill/press), so the
 * quality gate disqualified it via `no_user_interaction` and the
 * `auth-token-refresh` flow reported junk-only — coverage that looked green and
 * bought nothing.
 *
 * The behaviour is pure interceptor logic (`lib/services/http.ts:47-115`), so it
 * belongs here. `http.test.ts` already covers the two terminal cases (401 with no
 * refresh cookie clears auth; a 500 does not). What was never covered — and is
 * what actually keeps a user logged in — is the successful refresh-and-retry, the
 * two anti-recursion exclusions, the single-retry guard and the shared refresh
 * promise.
 */

import type { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';

jest.mock('js-cookie', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    set: jest.fn(),
    remove: jest.fn(),
  },
}));

type CookieMock = { get: jest.Mock; set: jest.Mock; remove: jest.Mock };

function unauthorized(config: AxiosRequestConfig) {
  return Promise.reject({
    isAxiosError: true,
    name: 'AxiosError',
    message: 'Request failed with status code 401',
    response: {
      data: { detail: 'Given token not valid for any token type' },
      status: 401,
      statusText: 'Unauthorized',
      headers: {},
      config,
    },
    config,
    toJSON: () => ({}),
  });
}

function ok(config: AxiosRequestConfig): AxiosResponse {
  return {
    data: { ok: true },
    status: 200,
    statusText: 'OK',
    headers: {},
    config,
  } as AxiosResponse;
}

function authHeaderOf(config: AxiosRequestConfig): string | undefined {
  const headers = config.headers as unknown as {
    Authorization?: string;
    get?: (k: string) => string | undefined;
  };
  return headers?.Authorization ?? headers?.get?.('Authorization');
}

describe('http service — response interceptor, token refresh', () => {
  let api: AxiosInstance;
  let Cookies: CookieMock;
  let refreshPost: jest.SpyInstance;
  let sent: AxiosRequestConfig[];
  let nextResponse: (config: AxiosRequestConfig) => Promise<AxiosResponse>;

  beforeEach(async () => {
    jest.resetModules();
    sent = [];

    Cookies = (await import('js-cookie')).default as unknown as CookieMock;
    Cookies.get.mockReset();
    Cookies.set.mockReset();
    Cookies.remove.mockReset();
    // Both cookies present: the state in which a refresh is actually attempted.
    Cookies.get.mockImplementation((key: string) => {
      if (key === 'kore_token') return 'stale-access';
      if (key === 'kore_refresh') return 'refresh-tok';
      return undefined;
    });

    const axiosModule = await import('axios');
    // The interceptor deliberately calls the BARE axios for the refresh so it
    // skips its own interceptors; spy on that exact call.
    refreshPost = jest
      .spyOn(axiosModule.default, 'post')
      .mockResolvedValue({ data: { access: 'fresh-access' } });

    api = (await import('@/lib/services/http')).api;
    api.defaults.adapter = (config) => {
      sent.push(config);
      return nextResponse(config);
    };
    nextResponse = async (config) => ok(config);
  });

  afterEach(() => {
    refreshPost.mockRestore();
  });

  it('refreshes the access token and retries the original request after a 401', async () => {
    // Catches: dropping the retry, which logs the user out every time the
    // access token expires instead of renewing it silently.
    nextResponse = async (config) => (sent.length === 1 ? unauthorized(config) : ok(config));

    const response = await api.get('/secured');

    expect(response.status).toBe(200);
    expect(refreshPost).toHaveBeenCalledTimes(1);
    expect(refreshPost.mock.calls[0][1]).toEqual({ refresh: 'refresh-tok' });
    expect(Cookies.set).toHaveBeenCalledWith('kore_token', 'fresh-access', { expires: 7 });
    // The retry must carry the NEW token, not the stale one that just 401'd.
    expect(sent).toHaveLength(2);
    expect(authHeaderOf(sent[1])).toBe('Bearer fresh-access');
  });

  it('does not try to refresh when the refresh endpoint itself returns 401', async () => {
    // Catches: the refresh-of-the-refresh loop — a dead refresh token would
    // otherwise recurse until the stack blows.
    nextResponse = async (config) => unauthorized(config);

    await expect(api.post('/auth/token/refresh/', { refresh: 'refresh-tok' })).rejects.toMatchObject({
      response: { status: 401 },
    });

    expect(refreshPost).not.toHaveBeenCalled();
  });

  it('does not try to refresh when the login endpoint returns 401', async () => {
    // Catches: bad credentials being swallowed by a refresh attempt instead of
    // surfacing as an invalid-login error to the form.
    nextResponse = async (config) => unauthorized(config);

    await expect(api.post('/auth/login/', { email: 'a@b.c' })).rejects.toMatchObject({
      response: { status: 401 },
    });

    expect(refreshPost).not.toHaveBeenCalled();
  });

  it('retries at most once — a 401 on the retry propagates to the caller', async () => {
    // Catches: removing the `_retry` guard, turning a genuinely revoked token
    // into an endless refresh/retry loop.
    nextResponse = async (config) => unauthorized(config);

    await expect(api.get('/secured')).rejects.toMatchObject({ response: { status: 401 } });

    expect(refreshPost).toHaveBeenCalledTimes(1);
    expect(sent).toHaveLength(2);
  });

  it('clears the auth cookies when the refresh call is rejected', async () => {
    // Catches: an expired refresh token leaving stale cookies behind, so the
    // next hydrate() believes it is authenticated and never routes to /login.
    refreshPost.mockRejectedValue(new Error('refresh token expired'));
    nextResponse = async (config) => unauthorized(config);

    await expect(api.get('/secured')).rejects.toMatchObject({ response: { status: 401 } });

    expect(Cookies.remove).toHaveBeenCalledWith('kore_token');
    expect(Cookies.remove).toHaveBeenCalledWith('kore_refresh');
    expect(Cookies.remove).toHaveBeenCalledWith('kore_user');
    expect(Cookies.set).not.toHaveBeenCalled();
  });

  it('coalesces concurrent 401s into a single refresh call', async () => {
    // Catches: losing the shared `refreshPromise`, so N parallel requests fire N
    // refreshes and race each other writing the kore_token cookie.
    nextResponse = async (config) => (sent.length <= 2 ? unauthorized(config) : ok(config));

    const [first, second] = await Promise.all([api.get('/one'), api.get('/two')]);

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(refreshPost).toHaveBeenCalledTimes(1);
  });
});
