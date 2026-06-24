import { create } from 'zustand';
import { api } from '@/lib/services/http';
import Cookies from 'js-cookie';
import type { Subscription } from './bookingStore';
import type { RenewalHistoryItem } from './adminSubscriptionStore';

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
  hasActiveSubscription: boolean;
  hasOwnActiveSubscription: boolean;
  subscriptionsLoaded: boolean;
  selectedSubscriptionId: number | null;
  payments: PaymentRecord[];
  expiryReminder: Subscription | null;
  loading: boolean;
  actionLoading: boolean;
  error: string;
  pendingInvitation: { token: string; host_name: string; package_title: string; invited_email: string } | null;
  fetchPendingInvitation: () => Promise<void>;
  acceptPendingInvitation: () => Promise<{ success: boolean; host_name?: string; package_title?: string }>;
  reset: () => void;
  fetchSubscriptions: () => Promise<void>;
  setSelectedSubscriptionId: (id: number | null) => void;
  cancelSubscription: (id: number) => Promise<boolean>;
  fetchPaymentHistory: (id: number) => Promise<void>;
  fetchRenewalHistory: (id: number) => Promise<RenewalHistoryItem[]>;
  fetchExpiryReminder: () => Promise<void>;
  acknowledgeExpiryReminder: (id: number) => Promise<boolean>;
  inviteGuest: (subscriptionId: number, email: string) => Promise<{ success: boolean; error?: string }>;
  revokeGuest: (subscriptionId: number) => Promise<boolean>;
};

function authHeaders() {
  const token = Cookies.get('kore_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export const useSubscriptionStore = create<SubscriptionState>((set, get) => ({
  subscriptions: [],
  activeSubscription: null,
  hasActiveSubscription: false,
  hasOwnActiveSubscription: false,
  subscriptionsLoaded: false,
  pendingInvitation: null,
  selectedSubscriptionId: null,
  payments: [],
  expiryReminder: null,
  loading: false,
  actionLoading: false,
  error: '',

  fetchPendingInvitation: async () => {
    try {
      const { data } = await api.get('/subscriptions/pending-invitation/', { headers: authHeaders() });
      set({ pendingInvitation: data ?? null });
    } catch {
      set({ pendingInvitation: null });
    }
  },

  acceptPendingInvitation: async () => {
    const inv = get().pendingInvitation;
    if (!inv) return { success: false };
    try {
      const { data } = await api.post('/subscriptions/accept-invite/', { token: inv.token }, { headers: authHeaders() });
      set({ pendingInvitation: null });
      await get().fetchSubscriptions();
      return { success: true, host_name: data.host_name, package_title: data.package_title };
    } catch {
      return { success: false };
    }
  },

  reset: () => set({
    subscriptions: [],
    activeSubscription: null,
    hasActiveSubscription: false,
    hasOwnActiveSubscription: false,
    subscriptionsLoaded: false,
    pendingInvitation: null,
    selectedSubscriptionId: null,
    payments: [],
    expiryReminder: null,
    error: '',
  }),

  fetchSubscriptions: async () => {
    // Dedupe concurrent callers — without this guard, the (app) layout and
    // the dashboard page can fire two parallel /subscriptions/ requests on
    // mount and trip nginx's per-IP `limit_req` burst.
    if (get().loading) return;
    set({ loading: true, error: '' });
    try {
      const { data } = await api.get('/subscriptions/', {
        headers: authHeaders(),
      });
      const list: Subscription[] = data.results ?? data;
      const active = list.find((s) => s.status === 'active') ?? null;
      const hasOwn = list.some((s) => !s.is_guest && s.status === 'active');
      set({ subscriptions: list, activeSubscription: active, hasActiveSubscription: active !== null, hasOwnActiveSubscription: hasOwn, subscriptionsLoaded: true, loading: false });
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
      const hasOwn = subs.some((s) => !s.is_guest && s.status === 'active');
      set({ subscriptions: subs, activeSubscription: active, hasActiveSubscription: active !== null, hasOwnActiveSubscription: hasOwn, actionLoading: false });
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

  fetchRenewalHistory: async (id: number) => {
    try {
      const { data } = await api.get(`/subscriptions/${id}/renewal-history/`, {
        headers: authHeaders(),
      });
      return Array.isArray(data) ? (data as RenewalHistoryItem[]) : [];
    } catch {
      return [];
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

  inviteGuest: async (subscriptionId: number, email: string) => {
    set({ actionLoading: true, error: '' });
    try {
      await api.post(`/subscriptions/${subscriptionId}/invite-guest/`, { email }, {
        headers: authHeaders(),
      });
      await get().fetchSubscriptions();
      set({ actionLoading: false });
      return { success: true };
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
        ?? 'No se pudo enviar la invitación.';
      set({ actionLoading: false, error: msg });
      return { success: false, error: msg };
    }
  },

  revokeGuest: async (subscriptionId: number) => {
    set({ actionLoading: true, error: '' });
    try {
      await api.post(`/subscriptions/${subscriptionId}/revoke-guest/`, {}, {
        headers: authHeaders(),
      });
      await get().fetchSubscriptions();
      set({ actionLoading: false });
      return true;
    } catch {
      set({ actionLoading: false, error: 'No se pudo revocar la invitación.' });
      return false;
    }
  },
}));
