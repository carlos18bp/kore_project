import { create } from 'zustand';
import Cookies from 'js-cookie';
import { api } from '@/lib/services/http';

export type TrainerClient = {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  avatar_url: string | null;
  primary_goal: string;
  active_package: string | null;
  sessions_remaining: number;
  total_sessions: number;
  completed_sessions: number;
  last_session_date: string | null;
};

export type ClientProfile = {
  sex: string;
  height_cm: string | null;
  current_weight_kg: string | null;
  city: string;
  primary_goal: string;
  kore_start_date: string | null;
};

export type ClientSubscription = {
  id: number;
  package_title: string;
  package_price: string;
  package_currency: string;
  sessions_total: number;
  sessions_used: number;
  sessions_remaining: number;
  starts_at: string;
  expires_at: string;
  next_billing_date: string | null;
  is_recurring: boolean;
  status: string;
};

export type ClientNextSession = {
  id: number;
  starts_at: string;
  ends_at: string;
  package_title: string;
  status: string;
};

export type ClientLastPayment = {
  amount: string;
  currency: string;
  created_at: string;
};

export type ClientDetail = {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  avatar_url: string | null;
  date_joined: string;
  profile: ClientProfile;
  subscription: ClientSubscription | null;
  next_session: ClientNextSession | null;
  last_payment: ClientLastPayment | null;
  stats: {
    total: number;
    completed: number;
    canceled: number;
    pending: number;
  };
};

export type ClientSession = {
  id: number;
  status: string;
  package_title: string;
  starts_at: string | null;
  ends_at: string | null;
  notes: string;
  canceled_reason: string;
  created_at: string;
};

export type UpcomingSession = {
  id: number;
  customer_name: string;
  customer_id: number;
  package_title: string;
  starts_at: string;
  ends_at: string;
  status: string;
};

export type TrainerDashboardStats = {
  total_clients: number;
  today_sessions: number;
  upcoming_sessions: UpcomingSession[];
};

type TrainerState = {
  clients: TrainerClient[];
  clientsLoading: boolean;
  selectedClient: ClientDetail | null;
  clientLoading: boolean;
  clientSessions: ClientSession[];
  sessionsLoading: boolean;
  dashboardStats: TrainerDashboardStats | null;
  statsLoading: boolean;
  error: string;
  fetchClients: () => Promise<void>;
  fetchClientDetail: (id: number) => Promise<void>;
  fetchClientSessions: (id: number) => Promise<void>;
  fetchDashboardStats: () => Promise<void>;
};

function authHeaders() {
  const token = Cookies.get('kore_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export const useTrainerStore = create<TrainerState>((set) => ({
  clients: [],
  clientsLoading: false,
  selectedClient: null,
  clientLoading: false,
  clientSessions: [],
  sessionsLoading: false,
  dashboardStats: null,
  statsLoading: false,
  error: '',

  fetchClients: async () => {
    set({ clientsLoading: true, error: '' });
    try {
      const { data } = await api.get('/trainer/my-clients/', {
        headers: authHeaders(),
      });
      set({ clients: data, clientsLoading: false });
    } catch {
      set({ error: 'No se pudieron cargar los clientes.', clientsLoading: false });
    }
  },

  fetchClientDetail: async (id: number) => {
    set({ clientLoading: true, error: '' });
    try {
      const { data } = await api.get(`/trainer/my-clients/${id}/`, {
        headers: authHeaders(),
      });
      set({ selectedClient: data, clientLoading: false });
    } catch {
      set({ error: 'No se pudo cargar la información del cliente.', clientLoading: false });
    }
  },

  fetchClientSessions: async (id: number) => {
    set({ sessionsLoading: true, error: '' });
    try {
      const { data } = await api.get(`/trainer/my-clients/${id}/sessions/`, {
        headers: authHeaders(),
      });
      set({ clientSessions: data, sessionsLoading: false });
    } catch {
      set({ error: 'No se pudo cargar el historial de sesiones.', sessionsLoading: false });
    }
  },

  fetchDashboardStats: async () => {
    set({ statsLoading: true, error: '' });
    try {
      const { data } = await api.get('/trainer/dashboard-stats/', {
        headers: authHeaders(),
      });
      set({ dashboardStats: data, statsLoading: false });
    } catch {
      set({ error: 'No se pudieron cargar las estadísticas.', statsLoading: false });
    }
  },
}));
