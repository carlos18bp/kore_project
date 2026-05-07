import { create } from 'zustand';
import Cookies from 'js-cookie';
import { api } from '@/lib/services/http';

export type AdminUser = {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  full_name: string;
  phone: string;
  role: 'customer' | 'trainer' | 'admin';
  is_active: boolean;
  must_change_password: boolean;
  date_joined: string;
  last_login: string | null;
  has_active_subscription: boolean;
  sessions_used_total: number;
  sessions_total_total: number;
};

export type AdminUserSubscriptionEntry = {
  id: number;
  package: {
    title: string;
    category: 'personalizado' | 'semi_personalizado' | 'terapeutico';
  };
  status: 'active' | 'expired' | 'canceled';
  starts_at: string;
  expires_at: string;
  sessions_used: number;
  sessions_total: number;
  role: 'host' | 'guest' | 'individual';
};

export type AdminUserDetail = AdminUser & {
  subscriptions: AdminUserSubscriptionEntry[];
};

export type AdminUserFilters = {
  search: string;
  role: 'all' | 'customer' | 'trainer';
  page: number;
};

export type CreateUserPayload = {
  email: string;
  first_name: string;
  last_name: string;
  phone?: string;
  role: 'customer' | 'trainer';
};

export type UpdateUserPayload = {
  first_name?: string;
  last_name?: string;
  phone?: string;
  role?: 'customer' | 'trainer';
  is_active?: boolean;
};

type AdminUserState = {
  users: AdminUser[];
  totalCount: number;
  selected: AdminUserDetail | null;
  filters: AdminUserFilters;
  loading: boolean;
  actionLoading: boolean;
  error: string;

  fetchUsers: (filters?: Partial<AdminUserFilters>) => Promise<void>;
  fetchById: (id: number) => Promise<void>;
  createUser: (payload: CreateUserPayload) => Promise<{ ok: true; user: AdminUserDetail } | { ok: false; errors: Record<string, string[]> }>;
  patchUser: (id: number, payload: UpdateUserPayload) => Promise<{ ok: true } | { ok: false; errors: Record<string, string[]> }>;
  resetUserPassword: (id: number) => Promise<boolean>;
  toggleActive: (id: number) => Promise<boolean>;
  deleteUser: (id: number) => Promise<boolean>;
  setFilters: (f: Partial<AdminUserFilters>) => void;
  reset: () => void;
};

function authHeaders() {
  const token = Cookies.get('kore_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export const useAdminUserStore = create<AdminUserState>((set, get) => ({
  users: [],
  totalCount: 0,
  selected: null,
  filters: { search: '', role: 'all', page: 1 },
  loading: false,
  actionLoading: false,
  error: '',

  setFilters: (f) => set((state) => ({ filters: { ...state.filters, ...f } })),

  reset: () =>
    set({
      users: [],
      totalCount: 0,
      selected: null,
      filters: { search: '', role: 'all', page: 1 },
      error: '',
    }),

  fetchUsers: async (filters) => {
    const merged = { ...get().filters, ...(filters ?? {}) };
    set({ loading: true, error: '', filters: merged });

    const params: Record<string, string | number> = { page: merged.page };
    if (merged.search) params.search = merged.search;
    if (merged.role && merged.role !== 'all') params.role = merged.role;

    try {
      const { data } = await api.get('/admin/users/', { headers: authHeaders(), params });
      const list: AdminUser[] = data.results ?? data;
      set({ users: list, totalCount: data.count ?? list.length, loading: false });
    } catch {
      set({ error: 'No se pudieron cargar los usuarios.', loading: false });
    }
  },

  fetchById: async (id) => {
    set({ loading: true, error: '' });
    try {
      const { data } = await api.get(`/admin/users/${id}/`, { headers: authHeaders() });
      set({ selected: data, loading: false });
    } catch {
      set({ error: 'No se pudo cargar el usuario.', loading: false });
    }
  },

  createUser: async (payload) => {
    set({ actionLoading: true, error: '' });
    try {
      const { data } = await api.post('/admin/users/', payload, { headers: authHeaders() });
      set({ actionLoading: false });
      return { ok: true, user: data as AdminUserDetail };
    } catch (err: unknown) {
      const errResp = (err as { response?: { data?: Record<string, string[]> } }).response;
      set({ actionLoading: false });
      return { ok: false, errors: errResp?.data ?? {} };
    }
  },

  patchUser: async (id, payload) => {
    set({ actionLoading: true, error: '' });
    try {
      const { data } = await api.patch(`/admin/users/${id}/`, payload, { headers: authHeaders() });
      set({ selected: data, actionLoading: false });
      return { ok: true };
    } catch (err: unknown) {
      const errResp = (err as { response?: { data?: Record<string, string[]> } }).response;
      set({ actionLoading: false });
      return { ok: false, errors: errResp?.data ?? {} };
    }
  },

  resetUserPassword: async (id) => {
    set({ actionLoading: true, error: '' });
    try {
      await api.post(`/admin/users/${id}/reset-password/`, {}, { headers: authHeaders() });
      // Refresh the selected user so the must_change_password badge updates.
      await get().fetchById(id);
      set({ actionLoading: false });
      return true;
    } catch {
      set({ error: 'No se pudo reenviar la contraseña.', actionLoading: false });
      return false;
    }
  },

  toggleActive: async (id) => {
    set({ actionLoading: true, error: '' });
    try {
      const { data } = await api.post(
        `/admin/users/${id}/toggle-active/`,
        {},
        { headers: authHeaders() },
      );
      set({ selected: data, actionLoading: false });
      return true;
    } catch {
      set({ error: 'No se pudo actualizar el estado del usuario.', actionLoading: false });
      return false;
    }
  },

  deleteUser: async (id) => {
    set({ actionLoading: true, error: '' });
    try {
      await api.delete(`/admin/users/${id}/`, { headers: authHeaders() });
      set((state) => ({
        users: state.users.filter((u) => u.id !== id),
        actionLoading: false,
      }));
      return true;
    } catch {
      set({ error: 'No se pudo eliminar el usuario.', actionLoading: false });
      return false;
    }
  },
}));
