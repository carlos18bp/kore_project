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
  selectedSubscriptionId: number | null;
  payments: PaymentRecord[];
  expiryReminder: Subscription | null;
  loading: boolean;
  actionLoading: boolean;
  error: string;
  fetchSubscriptions: () => Promise<void>;
  setSelectedSubscriptionId: (id: number | null) => void;
  cancelSubscription: (id: number) => Promise<boolean>;
  fetchPaymentHistory: (id: number) => Promise<void>;
  fetchExpiryReminder: () => Promise<void>;
  acknowledgeExpiryReminder: (id: number) => Promise<boolean>;
};

function authHeaders() {
  const token = Cookies.get('kore_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export const useSubscriptionStore = create<SubscriptionState>((set, get) => ({
  subscriptions: [],
  activeSubscription: null,
  selectedSubscriptionId: null,
  payments: [],
  expiryReminder: null,
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
      const active = list.find((s) => s.status === 'active') ?? null;
      set({ subscriptions: list, activeSubscription: active, loading: false });
    } catch {
      set({ error: 'No se pudieron cargar las suscripciones.', loading: false });
    }
  },

  setSelectedSubscriptionId: (id: number | null) => {
    set({ selectedSubscriptionId: id, payments: [], error: '' });
  },

  cancelSubscription: async (id: number) => {
    set({ actionLoading: true, error: '' });
    try {
      const { data } = await api.post(`/subscriptions/${id}/cancel/`, {}, {
        headers: authHeaders(),
      });
      const subs = get().subscriptions.map((s) => (s.id === id ? { ...s, ...data } : s));
      const active = subs.find((s) => s.status === 'active') ?? null;
      set({ subscriptions: subs, activeSubscription: active, actionLoading: false });
      return true;
    } catch {
      set({ error: 'No se pudo cancelar la suscripción.', actionLoading: false });
      return false;
    }
  },

  fetchPaymentHistory: async (id: number) => {
    set({ error: '', payments: [] });
    try {
      const { data } = await api.get(`/subscriptions/${id}/payments/`, {
        headers: authHeaders(),
      });
      set({ payments: data });
    } catch {
      set({ error: 'No se pudo cargar el historial de pagos.', payments: [] });
    }
  },

  fetchExpiryReminder: async () => {
    try {
      const { data } = await api.get('/subscriptions/expiry-reminder/', {
        headers: authHeaders(),
      });
      set({ expiryReminder: data?.id ? data : null });
    } catch {
      set({ expiryReminder: null });
    }
  },

  acknowledgeExpiryReminder: async (id: number) => {
    try {
      await api.post(`/subscriptions/${id}/expiry-reminder/ack/`, {}, {
        headers: authHeaders(),
      });
      set({ expiryReminder: null });
      return true;
    } catch {
      return false;
    }
  },
}));
