import { create } from 'zustand';
import Cookies from 'js-cookie';
import { api } from '@/lib/services/http';
import { AxiosError } from 'axios';

export type User = {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  phone: string;
  role: string;
  name: string;
};

type RegisterParams = {
  email: string;
  password: string;
  password_confirm: string;
  first_name: string;
  last_name: string;
  phone?: string;
};

type AuthState = {
  user: User | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  register: (params: RegisterParams) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  hydrate: () => void;
};

type LoginResponse = {
  user: {
    id: number;
    email: string;
    first_name: string;
    last_name: string;
    phone: string;
    role: string;
  };
  tokens: {
    access: string;
    refresh: string;
  };
};

function mapUser(raw: LoginResponse['user']): User {
  const first = raw.first_name || '';
  const last = raw.last_name || '';
  return {
    id: String(raw.id),
    email: raw.email,
    first_name: first,
    last_name: last,
    phone: raw.phone || '',
    role: raw.role,
    name: [first, last].filter(Boolean).join(' ') || raw.email,
  };
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: null,
  isAuthenticated: false,

  login: async (email: string, password: string) => {
    try {
      const { data } = await api.post<LoginResponse>('/auth/login/', { email, password });

      const user = mapUser(data.user);
      const accessToken = data.tokens.access;

      Cookies.set('kore_token', accessToken, { expires: 7 });
      Cookies.set('kore_refresh', data.tokens.refresh, { expires: 7 });
      Cookies.set('kore_user', JSON.stringify(user), { expires: 7 });

      set({ user, accessToken, isAuthenticated: true });
      return { success: true };
    } catch (err) {
      const axiosErr = err as AxiosError<Record<string, unknown>>;
      const detail = axiosErr.response?.data?.non_field_errors
        ?? axiosErr.response?.data?.detail;
      const message = Array.isArray(detail) ? detail[0] : detail;
      return {
        success: false,
        error: typeof message === 'string' ? message : 'Correo o contraseña incorrectos',
      };
    }
  },

  register: async (params: RegisterParams) => {
    try {
      const { data } = await api.post<LoginResponse>('/auth/register/', params);

      const user = mapUser(data.user);
      const accessToken = data.tokens.access;

      Cookies.set('kore_token', accessToken, { expires: 7 });
      Cookies.set('kore_refresh', data.tokens.refresh, { expires: 7 });
      Cookies.set('kore_user', JSON.stringify(user), { expires: 7 });

      set({ user, accessToken, isAuthenticated: true });
      return { success: true };
    } catch (err) {
      const axiosErr = err as AxiosError<Record<string, unknown>>;
      const responseData = axiosErr.response?.data;
      let message = 'Error al registrar la cuenta';
      if (responseData) {
        const firstError = Object.values(responseData)[0];
        if (Array.isArray(firstError)) {
          message = firstError[0] as string;
        } else if (typeof firstError === 'string') {
          message = firstError;
        }
      }
      return { success: false, error: message };
    }
  },

  logout: () => {
    Cookies.remove('kore_token');
    Cookies.remove('kore_refresh');
    Cookies.remove('kore_user');
    set({ user: null, accessToken: null, isAuthenticated: false });
  },

  hydrate: () => {
    const token = Cookies.get('kore_token');
    const userStr = Cookies.get('kore_user');
    if (token && userStr) {
      try {
        const user = JSON.parse(userStr) as User;
        set({ user, accessToken: token, isAuthenticated: true });
      } catch {
        Cookies.remove('kore_token');
        Cookies.remove('kore_refresh');
        Cookies.remove('kore_user');
      }
    }
  },
}));
