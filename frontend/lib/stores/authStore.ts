import { create } from 'zustand';
import Cookies from 'js-cookie';

export type User = {
  id: string;
  name: string;
  email: string;
  program: string;
  sessionsRemaining: number;
  nextSession: string;
  memberSince: string;
};

type AuthState = {
  user: User | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  hydrate: () => void;
};

// Simulated user for development
const MOCK_USER: User = {
  id: '1',
  name: 'Usuario Prueba',
  email: 'prueba@gmail.com',
  program: 'Personalizado FLW',
  sessionsRemaining: 8,
  nextSession: '2026-02-14T10:00:00',
  memberSince: '2025-11-01',
};

const MOCK_CREDENTIALS = {
  email: 'prueba@gmail.com',
  password: '123',
};

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: null,
  isAuthenticated: false,

  login: async (email: string, password: string) => {
    // Simulate API delay
    await new Promise((resolve) => setTimeout(resolve, 800));

    if (email === MOCK_CREDENTIALS.email && password === MOCK_CREDENTIALS.password) {
      const token = 'mock-jwt-token-' + Date.now();
      Cookies.set('kore_token', token, { expires: 7 });
      Cookies.set('kore_user', JSON.stringify(MOCK_USER), { expires: 7 });
      set({ user: MOCK_USER, accessToken: token, isAuthenticated: true });
      return { success: true };
    }

    return { success: false, error: 'Correo o contraseña incorrectos' };
  },

  logout: () => {
    Cookies.remove('kore_token');
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
        Cookies.remove('kore_user');
      }
    }
  },
}));
