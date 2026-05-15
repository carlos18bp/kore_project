import axios, { AxiosError, AxiosHeaders, InternalAxiosRequestConfig } from 'axios';
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
  (response) => response,
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
