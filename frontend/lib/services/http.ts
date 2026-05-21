import axios, {
  AxiosError,
  AxiosHeaders,
  InternalAxiosRequestConfig,
  type AxiosRequestConfig,
  type AxiosResponse,
} from 'axios';
import Cookies from 'js-cookie';

const fallbackBaseUrl = process.env.NODE_ENV === 'development'
  ? 'http://localhost:8000/api'
  : '/api';

export const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_BASE_URL || fallbackBaseUrl,
});

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = Cookies.get('kore_token');
  if (!token) return config;

  const headers = config.headers instanceof AxiosHeaders
    ? config.headers
    : new AxiosHeaders(config.headers as Record<string, string> | undefined);

  if (!headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  config.headers = headers;
  return config;
});

api.interceptors.response.use(
  (response) => {
    // DRF `Response(None)` (and any other 200-with-empty-body) is surfaced by
    // axios as `data: ""`, which slips past callers using `data ?? null`
    // (empty string is not nullish) and crashes consumers that optional-chain.
    // Normalize to `null` here so the "no resource" contract is uniform.
    if (response.data === '') {
      response.data = null;
    }
    return response;
  },
  (error: AxiosError) => {
    // SimpleJWT is configured without a refresh endpoint, so on a real 401
    // the only recovery is to drop the (now-invalid) auth cookies. The next
    // hydrate() will see no cookies and the (app) layout will route to /login.
    // Hard navigations (window.location) are intentionally avoided here so the
    // current request-bound caller can decide how to surface the failure.
    if (error.response?.status === 401) {
      Cookies.remove('kore_token');
      Cookies.remove('kore_refresh');
      Cookies.remove('kore_user');
    }
    return Promise.reject(error);
  },
);

/**
 * GET con reintentos ante 429 (rate limit de nginx). El dashboard dispara
 * muchas requests en paralelo; sin esto, un 429 deja el store vacío y la card
 * desaparece. Reintenta con backoff exponencial + jitter; otros errores se
 * propagan de inmediato.
 */
export async function getWithRetry<T = unknown>(
  url: string,
  config?: AxiosRequestConfig,
  retries = 3,
): Promise<AxiosResponse<T>> {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await api.get<T>(url, config);
    } catch (error) {
      const status = (error as AxiosError).response?.status;
      if (attempt >= retries || status !== 429) throw error;
      await new Promise((resolve) => {
        setTimeout(resolve, 400 * 2 ** attempt + Math.random() * 200);
      });
    }
  }
}
