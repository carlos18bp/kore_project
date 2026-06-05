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
  // Safety net: a request must never hang indefinitely and leave a form stuck
  // on "Guardando…". 60s is well above any normal response (saves are fast now
  // that the risk-score recompute runs in the background) yet still bounded.
  timeout: 60_000,
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

// Single-flight refresh: a burst of parallel requests that all 401 at once
// share one refresh round-trip instead of stampeding the refresh endpoint.
let refreshPromise: Promise<string | null> | null = null;

function dropAuthCookies() {
  Cookies.remove('kore_token');
  Cookies.remove('kore_refresh');
  Cookies.remove('kore_user');
}

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
  async (error: AxiosError) => {
    const original = error.config as
      | (InternalAxiosRequestConfig & { _retry?: boolean })
      | undefined;

    // Only attempt a refresh on a genuine 401 that we haven't already retried,
    // and never for the refresh/login calls themselves (those 401 legitimately
    // and must not recurse). Everything else propagates unchanged.
    if (
      error.response?.status !== 401 ||
      !original ||
      original._retry ||
      original.url?.includes('/auth/token/refresh/') ||
      original.url?.includes('/auth/login/')
    ) {
      return Promise.reject(error);
    }

    original._retry = true;

    if (!refreshPromise) {
      refreshPromise = (async () => {
        const refresh = Cookies.get('kore_refresh');
        if (!refresh) return null;
        try {
          // Use the bare `axios` (not `api`) so this call skips our own
          // interceptors and can't trigger a refresh-of-the-refresh loop.
          const { data } = await axios.post(
            `${api.defaults.baseURL}/auth/token/refresh/`,
            { refresh },
          );
          const newAccess: string = data.access;
          // Match the 7d cookie lifetime used elsewhere for kore_token.
          Cookies.set('kore_token', newAccess, { expires: 7 });
          return newAccess;
        } catch {
          return null;
        } finally {
          refreshPromise = null;
        }
      })();
    }

    const newToken = await refreshPromise;
    if (!newToken) {
      // Refresh unavailable or rejected: fall back to the original behavior —
      // drop the (now-invalid) auth cookies so the next hydrate() sees none and
      // the (app) layout routes to /login.
      dropAuthCookies();
      return Promise.reject(error);
    }

    const headers = original.headers instanceof AxiosHeaders
      ? original.headers
      : new AxiosHeaders(original.headers as Record<string, string> | undefined);
    headers.set('Authorization', `Bearer ${newToken}`);
    original.headers = headers;
    return api(original);
  },
);

/**
 * Extrae un mensaje de error legible de una falla de axios.
 *
 * Los stores solían leer únicamente `response.data.detail`, por lo que los
 * errores de validación de campo de DRF (`{campo: [msg]}`), los 5xx sin cuerpo
 * JSON y los timeouts/cortes de red quedaban en el mensaje genérico — o en
 * nada. Esta helper cubre esos casos para que el usuario siempre vea por qué
 * no se guardó, en vez de un botón colgado.
 */
export function extractApiError(error: unknown, fallback: string): string {
  const err = error as AxiosError | undefined;

  // Sin respuesta del servidor: timeout o red caída.
  if (err && !err.response) {
    if (err.code === 'ECONNABORTED') {
      return 'La operación tardó demasiado y se canceló. Verifica tu conexión e inténtalo de nuevo.';
    }
    return 'No se pudo contactar el servidor. Verifica tu conexión e inténtalo de nuevo.';
  }

  const data = err?.response?.data as
    | { detail?: string }
    | Record<string, unknown>
    | string
    | undefined;

  if (typeof data === 'string' && data.trim() && !data.trim().startsWith('<')) {
    return data;
  }
  if (data && typeof data === 'object') {
    if (typeof (data as { detail?: string }).detail === 'string') {
      return (data as { detail: string }).detail;
    }
    // Errores de validación de campo de DRF: {weight_kg: ["..."]}.
    for (const value of Object.values(data)) {
      if (Array.isArray(value) && typeof value[0] === 'string') return value[0];
      if (typeof value === 'string' && value.trim()) return value;
    }
  }
  return fallback;
}

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
