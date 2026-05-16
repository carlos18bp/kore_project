import { create } from 'zustand';
import Cookies from 'js-cookie';
import { api } from '@/lib/services/http';
import axios, { AxiosError } from 'axios';
import { useSubscriptionStore } from './subscriptionStore';
import { useBookingStore } from './bookingStore';

export type AssignedTrainer = {
  id: number;
  first_name: string;
  last_name: string;
  location: string;
  session_duration_minutes: number;
};

export type User = {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  phone: string;
  role: string;
  name: string;
  profile_completed: boolean;
  avatar_url: string | null;
  must_change_password: boolean;
  assigned_trainer: AssignedTrainer | null;
};

type RegisterParams = {
  email: string;
  password: string;
  password_confirm: string;
  first_name: string;
  last_name: string;
  phone?: string;
  captcha_token?: string;
};

type AuthState = {
  user: User | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  justLoggedIn: boolean;
  hydrated: boolean;
  // True only when the in-memory session was reconstructed from cookies and
  // still needs a backend `/auth/profile/` revalidation. login/register set it
  // to false because they already produced the data from the backend.
  pendingRevalidation: boolean;
  login: (email: string, password: string, captchaToken?: string) => Promise<{ success: boolean; error?: string }>;
  register: (params: RegisterParams) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  hydrate: () => void;
  clearJustLoggedIn: () => void;
};

type LoginResponse = {
  user: {
    id: number;
    email: string;
    first_name: string;
    last_name: string;
    phone: string;
    role: string;
    must_change_password?: boolean;
  };
  tokens: {
    access: string;
    refresh: string;
  };
};

type ProfileResponse = {
  user: LoginResponse['user'] & {
    customer_profile?: {
      avatar_url: string | null;
      sex: string;
      date_of_birth: string | null;
      eps: string;
      id_type: string;
      id_number: string;
      id_expedition_date: string | null;
      address: string;
      city: string;
      primary_goal: string;
      kore_start_date: string | null;
      profile_completed: boolean;
    } | null;
    today_mood?: { score: number; notes: string; date: string } | null;
    assigned_trainer?: AssignedTrainer | null;
  };
};

function clearAuthCookies() {
  Cookies.remove('kore_token');
  Cookies.remove('kore_refresh');
  Cookies.remove('kore_user');
}

export const SPLASH_SHOWN_KEY = 'kore_splash_shown';

function clearSplashShown() {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.removeItem(SPLASH_SHOWN_KEY);
  } catch {
    // sessionStorage may be unavailable (private mode, SSR edge cases) — ignore.
  }
}

type AuthSnapshot = {
  user: User | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  hydrated: boolean;
  pendingRevalidation: boolean;
};

const EMPTY_SNAPSHOT: AuthSnapshot = {
  user: null,
  accessToken: null,
  isAuthenticated: false,
  hydrated: false,
  pendingRevalidation: false,
};

// Read cookies synchronously at store construction so `hydrated` is true on the
// first render when a valid session exists. This prevents the (app) layout
// from flashing the splash on every navigation under static export, where each
// route is a separate HTML file and the JS bundle re-initializes the store.
function readAuthFromCookies(): AuthSnapshot {
  if (typeof window === 'undefined') return EMPTY_SNAPSHOT;
  const token = Cookies.get('kore_token');
  const userStr = Cookies.get('kore_user');
  if (!token || !userStr) return EMPTY_SNAPSHOT;
  try {
    const user = JSON.parse(userStr) as User;
    return { user, accessToken: token, isAuthenticated: true, hydrated: true, pendingRevalidation: true };
  } catch {
    return EMPTY_SNAPSHOT;
  }
}

export function mapUser(raw: LoginResponse['user'], extra?: { profile_completed?: boolean; avatar_url?: string | null; assigned_trainer?: AssignedTrainer | null }): User {
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
    profile_completed: extra?.profile_completed ?? false,
    avatar_url: extra?.avatar_url ?? null,
    must_change_password: raw.must_change_password ?? false,
    assigned_trainer: extra?.assigned_trainer ?? null,
  };
}

function revalidateProfile(token: string, set: (partial: Partial<AuthState>) => void) {
  void api.get<ProfileResponse>('/auth/profile/', {
    headers: { Authorization: `Bearer ${token}` },
  })
    .then(({ data }) => {
      const cp = data.user.customer_profile;
      const user = mapUser(data.user, {
        profile_completed: cp?.profile_completed ?? false,
        avatar_url: cp?.avatar_url ?? null,
        assigned_trainer: data.user.assigned_trainer ?? null,
      });
      Cookies.set('kore_user', JSON.stringify(user), { expires: 7 });
      set({ user, accessToken: token, isAuthenticated: true });
    })
    .catch((err: unknown) => {
      // Only log out when the server *explicitly* rejects auth. Transient 5xx
      // / network / 404 must NOT wipe the session — that turned every flaky
      // /auth/profile/ call into a forced logout.
      const status = axios.isAxiosError(err) ? err.response?.status : undefined;
      if (status === 401 || status === 403) {
        clearAuthCookies();
        set({ user: null, accessToken: null, isAuthenticated: false });
      }
    });
}

const initialAuth = readAuthFromCookies();

export const useAuthStore = create<AuthState>((set, get) => ({
  user: initialAuth.user,
  accessToken: initialAuth.accessToken,
  isAuthenticated: initialAuth.isAuthenticated,
  justLoggedIn: false,
  hydrated: initialAuth.hydrated,
  pendingRevalidation: initialAuth.pendingRevalidation,

  login: async (email: string, password: string, captchaToken?: string) => {
    try {
      const { data } = await api.post<LoginResponse>('/auth/login/', { email, password, captcha_token: captchaToken });

      const user = mapUser(data.user);
      const accessToken = data.tokens.access;

      Cookies.set('kore_token', accessToken, { expires: 7 });
      Cookies.set('kore_refresh', data.tokens.refresh, { expires: 7 });
      Cookies.set('kore_user', JSON.stringify(user), { expires: 7 });

      /* istanbul ignore else -- @preserve: SSR guard; login only runs from client interactions */
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem('kore_reminder_dismissed');
      }
      clearSplashShown();

      set({ user, accessToken, isAuthenticated: true, justLoggedIn: true, hydrated: true, pendingRevalidation: false });
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
      clearSplashShown();

      set({ user, accessToken, isAuthenticated: true, hydrated: true, pendingRevalidation: false });
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
    clearAuthCookies();
    /* istanbul ignore else -- @preserve: SSR guard; logout only runs from client interactions */
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('kore_reminder_dismissed');
    }
    clearSplashShown();
    useSubscriptionStore.getState().reset();
    useBookingStore.setState({
      subscriptions: [],
      bookings: [],
      upcomingReminder: null,
      bookingDetail: null,
      step: 1,
      selectedDate: null,
      selectedStartsAt: null,
      bookingResult: null,
    });
    set({ user: null, accessToken: null, isAuthenticated: false, pendingRevalidation: false });
  },

  hydrate: () => {
    const state = get();

    // Already hydrated and no pending backend revalidation — nothing to do.
    if (state.hydrated && !state.pendingRevalidation) return;

    // State is in memory (from login/register or from cookies at module init).
    if (state.isAuthenticated && state.accessToken && state.user) {
      if (!state.pendingRevalidation) {
        set({ hydrated: true });
        return;
      }
      // Mark non-pending up front so a re-entrant hydrate() call does not
      // double-fire the network request.
      set({ hydrated: true, pendingRevalidation: false });
      revalidateProfile(state.accessToken, set);
      return;
    }

    // No in-memory session — try to recover from cookies (covers test setups
    // that mock cookies after module load).
    const token = Cookies.get('kore_token');
    const userStr = Cookies.get('kore_user');

    if (!token || !userStr) {
      set({ user: null, accessToken: null, isAuthenticated: false, hydrated: true, pendingRevalidation: false });
      return;
    }

    let cachedUser: User;
    try {
      cachedUser = JSON.parse(userStr) as User;
    } catch {
      clearAuthCookies();
      set({ user: null, accessToken: null, isAuthenticated: false, hydrated: true, pendingRevalidation: false });
      return;
    }

    // Optimistic hydration: trust the cookie-cached user immediately so the
    // (app) layout doesn't bounce to /login while we revalidate.
    set({ user: cachedUser, accessToken: token, isAuthenticated: true, hydrated: true, pendingRevalidation: false });
    revalidateProfile(token, set);
  },

  clearJustLoggedIn: () => {
    set({ justLoggedIn: false });
  },
}));
