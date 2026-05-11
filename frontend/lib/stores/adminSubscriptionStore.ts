import { create } from 'zustand';
import { api } from '@/lib/services/http';
import Cookies from 'js-cookie';

export type AdminSubscriptionGuestInfo = {
  status: 'pending' | 'accepted' | 'revoked';
  invited_email: string;
  guest_name: string | null;
  guest_user_id: number | null;
  accepted_at: string | null;
};

export type AdminSubscription = {
  id: number;
  customer_id: number;
  customer_email: string;
  customer_name: string;
  package: {
    id: number;
    title: string;
    category: 'personalizado' | 'semi_personalizado' | 'terapeutico';
    sessions_count: number;
    session_duration_minutes: number;
    price: string;
    currency: string;
    validity_days: number;
  };
  sessions_total: number;
  sessions_used: number;
  sessions_remaining: number;
  status: 'active' | 'expired' | 'canceled';
  starts_at: string;
  expires_at: string;
  is_recurring: boolean;
  next_billing_date: string | null;
  billing_failed_at: string | null;
  is_duo: boolean;
  guest_info: AdminSubscriptionGuestInfo | null;
  created_at: string;
  updated_at: string;
};

export type AdminCreateSubscriptionPayload = {
  action: 'create' | 'evolve';
  customer_id: number;
  package_id: number;
  payment_method: 'cash' | 'transfer';
  starts_at?: string;
  expires_at?: string;
  sessions_used?: number;
  notes?: string;
};

export type AdminCreateSubscriptionError = {
  status: number;
  detail: string;
  expectedAction: 'create' | 'evolve' | null;
};

export type PatchSubscriptionPayload = {
  status?: 'active' | 'expired' | 'canceled';
  sessions_total?: number;
  sessions_used?: number;
  starts_at?: string;
  expires_at?: string;
  is_recurring?: boolean;
  next_billing_date?: string | null;
};

export type AdminSubscriptionFilters = {
  search: string;
  status: string;
  category: 'personalizado' | 'semi_personalizado' | 'terapeutico' | '';
  page: number;
};

type AdminSubscriptionState = {
  subscriptions: AdminSubscription[];
  totalCount: number;
  selected: AdminSubscription | null;
  filters: AdminSubscriptionFilters;
  loading: boolean;
  actionLoading: boolean;
  error: string;

  fetchSubscriptions: (filters?: Partial<AdminSubscriptionFilters>) => Promise<void>;
  fetchById: (id: number) => Promise<void>;
  patchSubscription: (id: number, payload: PatchSubscriptionPayload) => Promise<boolean>;
  renewSubscription: (id: number) => Promise<AdminSubscription | null>;
  deleteSubscription: (id: number) => Promise<{ ok: true } | { ok: false; detail: string }>;
  createOrEvolveSubscription: (
    payload: AdminCreateSubscriptionPayload,
  ) => Promise<{ ok: true; subscription: AdminSubscription } | { ok: false; error: AdminCreateSubscriptionError }>;
  setFilters: (f: Partial<AdminSubscriptionFilters>) => void;
  reset: () => void;
};

function authHeaders() {
  const token = Cookies.get('kore_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export const useAdminSubscriptionStore = create<AdminSubscriptionState>((set, get) => ({
  subscriptions: [],
  totalCount: 0,
  selected: null,
  filters: { search: '', status: '', category: '', page: 1 },
  loading: false,
  actionLoading: false,
  error: '',

  setFilters: (f) => {
    set((state) => ({ filters: { ...state.filters, ...f } }));
  },

  reset: () => set({
    subscriptions: [],
    totalCount: 0,
    selected: null,
    filters: { search: '', status: '', category: '', page: 1 },
    error: '',
  }),

  fetchSubscriptions: async (filters) => {
    const merged = { ...get().filters, ...(filters ?? {}) };
    set({ loading: true, error: '', filters: merged });

    const params: Record<string, string | number> = { page: merged.page };
    if (merged.search) params.search = merged.search;
    if (merged.status) params.status = merged.status;
    if (merged.category) params.category = merged.category;

    try {
      const { data } = await api.get('/subscriptions/', {
        headers: authHeaders(),
        params,
      });
      const list: AdminSubscription[] = data.results ?? data;
      set({ subscriptions: list, totalCount: data.count ?? list.length, loading: false });
    } catch {
      set({ error: 'No se pudieron cargar las suscripciones.', loading: false });
    }
  },

  fetchById: async (id: number) => {
    set({ loading: true, error: '' });
    try {
      const { data } = await api.get(`/subscriptions/${id}/`, { headers: authHeaders() });
      set({ selected: data, loading: false });
    } catch {
      set({ error: 'No se pudo cargar la suscripción.', loading: false });
    }
  },

  patchSubscription: async (id: number, payload: PatchSubscriptionPayload) => {
    set({ actionLoading: true, error: '' });
    try {
      const { data } = await api.patch(`/subscriptions/${id}/`, payload, { headers: authHeaders() });
      set({ selected: data, actionLoading: false });
      return true;
    } catch {
      set({ error: 'No se pudo actualizar la suscripción.', actionLoading: false });
      return false;
    }
  },

  renewSubscription: async (id: number) => {
    set({ actionLoading: true, error: '' });
    try {
      const { data } = await api.post(`/subscriptions/${id}/admin-renew/`, {}, { headers: authHeaders() });
      set({ actionLoading: false });
      return data as AdminSubscription;
    } catch {
      set({ error: 'No se pudo renovar la suscripción.', actionLoading: false });
      return null;
    }
  },

  deleteSubscription: async (id: number) => {
    set({ actionLoading: true, error: '' });
    try {
      await api.delete(`/subscriptions/${id}/admin-delete/`, { headers: authHeaders() });
      set((state) => ({
        subscriptions: state.subscriptions.filter((s) => s.id !== id),
        selected: state.selected?.id === id ? null : state.selected,
        actionLoading: false,
      }));
      return { ok: true as const };
    } catch (err) {
      const e = err as { response?: { data?: { detail?: string } } };
      const detail = e.response?.data?.detail ?? 'No se pudo eliminar la suscripción.';
      set({ error: detail, actionLoading: false });
      return { ok: false as const, detail };
    }
  },

  createOrEvolveSubscription: async (payload) => {
    set({ actionLoading: true, error: '' });
    try {
      const { data } = await api.post('/subscriptions/admin-create/', payload, {
        headers: authHeaders(),
      });
      set({ actionLoading: false });
      return { ok: true as const, subscription: data as AdminSubscription };
    } catch (err) {
      const e = err as { response?: { status?: number; data?: { detail?: string; expected_action?: 'create' | 'evolve' } } };
      const status = e.response?.status ?? 0;
      const detail = e.response?.data?.detail ?? 'No se pudo registrar la suscripción.';
      const expectedAction = e.response?.data?.expected_action ?? null;
      set({ actionLoading: false, error: detail });
      return {
        ok: false as const,
        error: { status, detail, expectedAction },
      };
    }
  },
}));
