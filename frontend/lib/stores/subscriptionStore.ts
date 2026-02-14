import { create } from 'zustand';
import { api } from '@/lib/services/http';
import Cookies from 'js-cookie';
import type { Subscription } from './bookingStore';

export type PaymentRecord = {
  id: number;
  amount: string;
  currency: string;
  status: string;
  provider: string;
  provider_reference: string;
  created_at: string;
};

type SubscriptionState = {
  subscriptions: Subscription[];
  activeSubscription: Subscription | null;
  payments: PaymentRecord[];
  loading: boolean;
  actionLoading: boolean;
  error: string;
  fetchSubscriptions: () => Promise<void>;
  pauseSubscription: (id: number) => Promise<boolean>;
  resumeSubscription: (id: number) => Promise<boolean>;
  cancelSubscription: (id: number) => Promise<boolean>;
  fetchPaymentHistory: (id: number) => Promise<void>;
};

function authHeaders() {
  const token = Cookies.get('kore_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export const useSubscriptionStore = create<SubscriptionState>((set, get) => ({
  subscriptions: [],
  activeSubscription: null,
  payments: [],
  loading: false,
  actionLoading: false,
  error: '',

  fetchSubscriptions: async () => {
    set({ loading: true, error: '' });
    try {
      const { data } = await api.get('/subscriptions/', {
        headers: authHeaders(),
      });
      const list: Subscription[] = data.results ?? data;
      const active = list.find((s) => s.status === 'active' || s.status === 'paused') ?? null;
      set({ subscriptions: list, activeSubscription: active, loading: false });
    } catch {
      set({ error: 'No se pudieron cargar las suscripciones.', loading: false });
    }
  },

  pauseSubscription: async (id: number) => {
    set({ actionLoading: true, error: '' });
    try {
      const { data } = await api.post(`/subscriptions/${id}/pause/`, {}, {
        headers: authHeaders(),
      });
      const subs = get().subscriptions.map((s) => (s.id === id ? { ...s, ...data } : s));
      const active = subs.find((s) => s.status === 'active' || s.status === 'paused') ?? null;
      set({ subscriptions: subs, activeSubscription: active, actionLoading: false });
      return true;
    } catch {
      set({ error: 'No se pudo pausar la suscripción.', actionLoading: false });
      return false;
    }
  },

  resumeSubscription: async (id: number) => {
    set({ actionLoading: true, error: '' });
    try {
      const { data } = await api.post(`/subscriptions/${id}/resume/`, {}, {
        headers: authHeaders(),
      });
      const subs = get().subscriptions.map((s) => (s.id === id ? { ...s, ...data } : s));
      const active = subs.find((s) => s.status === 'active' || s.status === 'paused') ?? null;
      set({ subscriptions: subs, activeSubscription: active, actionLoading: false });
      return true;
    } catch {
      set({ error: 'No se pudo reanudar la suscripción.', actionLoading: false });
      return false;
    }
  },

  cancelSubscription: async (id: number) => {
    set({ actionLoading: true, error: '' });
    try {
      const { data } = await api.post(`/subscriptions/${id}/cancel/`, {}, {
        headers: authHeaders(),
      });
      const subs = get().subscriptions.map((s) => (s.id === id ? { ...s, ...data } : s));
      const active = subs.find((s) => s.status === 'active' || s.status === 'paused') ?? null;
      set({ subscriptions: subs, activeSubscription: active, actionLoading: false });
      return true;
    } catch {
      set({ error: 'No se pudo cancelar la suscripción.', actionLoading: false });
      return false;
    }
  },

  fetchPaymentHistory: async (id: number) => {
    set({ error: '' });
    try {
      const { data } = await api.get(`/subscriptions/${id}/payments/`, {
        headers: authHeaders(),
      });
      set({ payments: data });
    } catch {
      set({ error: 'No se pudo cargar el historial de pagos.' });
    }
  },
}));
