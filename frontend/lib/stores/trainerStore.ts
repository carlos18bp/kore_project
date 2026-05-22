import { create } from 'zustand';
import Cookies from 'js-cookie';
import { api } from '@/lib/services/http';

// ── Existing types ────────────────────────────────────────────────────────────

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
  date_of_birth: string | null;
  eps: string;
  id_type: string;
  id_number: string;
  id_expedition_date: string | null;
  address: string;
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
  fitness_level_computed: number;
  fitness_level_override: number | null;
};

export type ClientSession = {
  id: number;
  status: string;
  package_title: string;
  starts_at: string | null;
  ends_at: string | null;
  notes: string;
  canceled_reason: string;
  session_objective: string;
  session_notes_for_customer: string;
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

// ── New Intelligence Center types ─────────────────────────────────────────────

export type RiskLevel = 'alto' | 'medio' | 'bajo' | 'sin_riesgo';

export type RiskSignal = {
  type: string;
  label: string;
  severity: 'alto' | 'medio' | 'bajo';
  detail: string;
  since_date: string | null;
  module?: string;
  last_eval_date?: string | null;
};

export type AlertResolution = {
  id: number;
  signal_type: string;
  resolution_type: string;
  note: string;
  is_public: boolean;
  resolved_at: string;
};

export type ClientRiskScore = {
  id: number;
  customer_id: number;
  customer_name: string;
  avatar_url: string | null;
  level: RiskLevel;
  computed_at: string;
  kore_score: number | null;
  signals_count: number;
  behavioral_signals: RiskSignal[];
  clinical_signals: RiskSignal[];
  resolutions: AlertResolution[];
  is_stale?: boolean;
};

export type RiskDashboard = {
  risk_summary: { alto: number; medio: number; bajo: number; sin_riesgo: number };
  clients_by_risk: ClientRiskScore[];
};

export type ClientKPI = {
  behavioral: {
    training_adherence_7d: number;
    nutrition_adherence_7d: number;
    combined_adherence_7d: number;
    streak_current: number;
    streak_longest: number;
    sessions_completed: number;
    sessions_remaining: number;
    last_activity_date: string | null;
    last_mood_score: number | null;
  };
  clinical: {
    kore_score: number | null;
    kore_color: string;
    kore_category: string;
    bmi: number | null;
    bmi_color: string;
    body_fat_pct: number | null;
    bf_color: string;
    global_postural_index: number | null;
    postural_color: string;
    physical_general_index: number | null;
    physical_color: string;
    nutrition_habit_score: number | null;
    nutrition_color: string;
    last_eval_dates: Record<string, string | null>;
  };
};

export type TrainerMessageItem = {
  id: number;
  customer_id: number;
  trigger_type: string;
  message: string;
  is_visible: boolean;
  seen_by_customer: boolean;
  created_at: string;
};

export type ComparativeMetrics = {
  adherence_ranking: Array<{
    customer_id: number;
    name: string;
    avatar_url: string | null;
    combined_7d: number;
    delta_vs_last_week: number;
    trend: string;
  }>;
  improved_this_week: Array<{ customer_id: number; name: string; delta: number }>;
  worsened_this_week: Array<{ customer_id: number; name: string; delta: number }>;
  global_patterns: {
    avg_training_adherence: number;
    avg_nutrition_adherence: number;
    most_missed_day_of_week: string | null;
  };
  most_failed_exercises?: Array<{ name: string; count: number }>;
  most_failed_meal_blocks?: Array<{ block: string; block_label: string; count: number }>;
  expired_evaluations: Array<{
    customer_id: number;
    name: string;
    module: string;
    module_label: string;
    days_since: number;
    urgency: string;
  }>;
};

export type DailyLogDay = {
  date: string;
  day_number: number;
  day_type: string;
  training_adherence: number;
  nutrition_adherence: number;
  combined_adherence: number;
  exercises: Array<{
    exercise_id: number;
    exercise_name: string;
    sets: number;
    reps: number | null;
    duration_seconds: number | null;
    status: string;
  }>;
};

export type NutritionLogDay = {
  date: string;
  adherence: number;
  is_closed: boolean;
  meals: Array<{
    meal_entry_id: number;
    meal_block: string;
    status: string;
    suggestion: string | null;
    notes: string;
    photo_url: string | null;
  }>;
  water_glasses: Array<{
    id: number;
    photo_url: string | null;
  }>;
};

// ── Store state + actions ─────────────────────────────────────────────────────

type TrainerState = {
  // Existing
  clients: TrainerClient[];
  clientsLoading: boolean;
  selectedClient: ClientDetail | null;
  clientLoading: boolean;
  clientSessions: ClientSession[];
  sessionsLoading: boolean;
  dashboardStats: TrainerDashboardStats | null;
  statsLoading: boolean;
  agendaSessions: UpcomingSession[];
  agendaLoading: boolean;
  error: string;
  fetchClients: () => Promise<void>;
  fetchClientDetail: (id: number) => Promise<void>;
  fetchClientSessions: (id: number) => Promise<void>;
  fetchDashboardStats: () => Promise<void>;
  fetchAgendaSessions: (from: string, to: string) => Promise<void>;

  // Intelligence Center
  riskDashboard: RiskDashboard | null;
  riskDashboardLoading: boolean;
  clientKPIs: Record<number, ClientKPI>;
  kpiLoading: boolean;
  alerts: ClientRiskScore[];
  alertsLoading: boolean;
  clientAlerts: Record<number, ClientRiskScore[]>;
  clientAlertsLoading: boolean;
  trainerMessages: Record<number, TrainerMessageItem[]>;
  messagesLoading: boolean;
  comparativeMetrics: ComparativeMetrics | null;
  comparativeLoading: boolean;
  clientDailyLogs: Record<number, DailyLogDay[]>;
  dailyLogsLoading: boolean;
  clientNutritionLogs: Record<number, NutritionLogDay[]>;
  nutritionLogsLoading: boolean;
  clientSessionsFull: Record<number, ClientSession[]>;
  sessionsFullLoading: boolean;
  programActionLoading: boolean;

  fetchRiskDashboard: () => Promise<void>;
  fetchClientKPI: (customerId: number) => Promise<void>;
  fetchAlerts: (params?: { level?: string }) => Promise<void>;
  resolveAlert: (riskScoreId: number, payload: {
    signal_type: string;
    resolution_type: string;
    note: string;
    is_public?: boolean;
  }) => Promise<void>;
  sendTrainerMessage: (customerId: number, message: string, triggerType?: string, triggerRefId?: number) => Promise<void>;
  fetchTrainerMessages: (customerId: number) => Promise<void>;
  updateTrainerMessage: (customerId: number, messageId: number, message: string) => Promise<void>;
  deleteTrainerMessage: (customerId: number, messageId: number) => Promise<void>;
  fetchComparativeMetrics: () => Promise<void>;
  fetchClientAlerts: (customerId: number) => Promise<void>;
  pauseProgram: (customerId: number, programId: number, reason: string) => Promise<void>;
  resumeProgram: (customerId: number, programId: number) => Promise<void>;
  fetchClientDailyLogs: (customerId: number, days?: number) => Promise<void>;
  fetchClientNutritionLogs: (customerId: number, days?: number) => Promise<void>;
  fetchClientSessionsFull: (customerId: number) => Promise<void>;
  updateSessionObjective: (customerId: number, bookingId: number, objective: string) => Promise<void>;

  // ── Notes hub: monthly programs ──
  clientMonthlyPrograms: Record<number, ClientMonthlyProgram[]>;
  monthlyProgramsLoading: boolean;
  fetchClientMonthlyPrograms: (customerId: number) => Promise<void>;
  updateMonthlyProgramNote: (customerId: number, programId: number, notes: string) => Promise<void>;

  // ── Notes hub: weekly nutrition plans ──
  clientWeeklyPlans: Record<number, ClientWeeklyPlan[]>;
  weeklyPlansLoading: boolean;
  fetchClientWeeklyPlans: (customerId: number) => Promise<void>;
  updateWeeklyPlanNote: (customerId: number, planId: number, notes: string) => Promise<void>;
};

export type ClientMonthlyProgram = {
  id: number;
  start_date: string;
  end_date: string;
  status: string;
  goal: string;
  fitness_level: number;
  trainer_notes: string;
  approved_at: string | null;
  is_paused: boolean;
};

export type ClientWeeklyPlan = {
  id: number;
  week_start: string;
  week_end: string;
  status: string;
  goal: string;
  fitness_level: number;
  trainer_notes: string;
  approved_at: string | null;
};

function authHeaders() {
  const token = Cookies.get('kore_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export const useTrainerStore = create<TrainerState>((set, get) => ({
  // Existing state
  clients: [],
  clientsLoading: false,
  selectedClient: null,
  clientLoading: false,
  clientSessions: [],
  sessionsLoading: false,
  dashboardStats: null,
  statsLoading: false,
  agendaSessions: [],
  agendaLoading: false,
  error: '',

  // Intelligence Center state
  riskDashboard: null,
  riskDashboardLoading: false,
  clientKPIs: {},
  kpiLoading: false,
  alerts: [],
  alertsLoading: false,
  clientAlerts: {},
  clientAlertsLoading: false,
  trainerMessages: {},
  messagesLoading: false,
  comparativeMetrics: null,
  comparativeLoading: false,
  clientDailyLogs: {},
  dailyLogsLoading: false,
  clientNutritionLogs: {},
  nutritionLogsLoading: false,
  clientSessionsFull: {},
  sessionsFullLoading: false,
  programActionLoading: false,
  clientMonthlyPrograms: {},
  monthlyProgramsLoading: false,
  clientWeeklyPlans: {},
  weeklyPlansLoading: false,

  // ── Existing actions ──────────────────────────────────────────────────────

  fetchClients: async () => {
    set({ clientsLoading: true, error: '' });
    try {
      const { data } = await api.get('/trainer/my-clients/', { headers: authHeaders() });
      set({ clients: data, clientsLoading: false });
    } catch {
      set({ error: 'No se pudieron cargar los clientes.', clientsLoading: false });
    }
  },

  fetchClientDetail: async (id: number) => {
    set({ clientLoading: true, error: '' });
    try {
      const { data } = await api.get(`/trainer/my-clients/${id}/`, { headers: authHeaders() });
      set({ selectedClient: data, clientLoading: false });
    } catch {
      set({ error: 'No se pudo cargar la información del cliente.', clientLoading: false });
    }
  },

  fetchClientSessions: async (id: number) => {
    set({ sessionsLoading: true, error: '' });
    try {
      const { data } = await api.get(`/trainer/my-clients/${id}/sessions/`, { headers: authHeaders() });
      set({ clientSessions: data, sessionsLoading: false });
    } catch {
      set({ error: 'No se pudo cargar el historial de sesiones.', sessionsLoading: false });
    }
  },

  fetchDashboardStats: async () => {
    set({ statsLoading: true, error: '' });
    try {
      const { data } = await api.get('/trainer/dashboard-stats/', { headers: authHeaders() });
      set({ dashboardStats: data, statsLoading: false });
    } catch {
      set({ error: 'No se pudieron cargar las estadísticas.', statsLoading: false });
    }
  },

  fetchAgendaSessions: async (from: string, to: string) => {
    set({ agendaLoading: true });
    try {
      const { data } = await api.get('/trainer/agenda/', {
        headers: authHeaders(),
        params: { from, to },
      });
      set({ agendaSessions: data.sessions ?? [], agendaLoading: false });
    } catch {
      set({ agendaSessions: [], agendaLoading: false });
    }
  },

  // ── Intelligence Center actions ───────────────────────────────────────────

  fetchRiskDashboard: async () => {
    set({ riskDashboardLoading: true });
    try {
      const { data } = await api.get('/trainer/risk-dashboard/', { headers: authHeaders() });
      set({ riskDashboard: data, riskDashboardLoading: false });
    } catch {
      set({ riskDashboardLoading: false });
    }
  },

  fetchClientKPI: async (customerId: number) => {
    set({ kpiLoading: true });
    try {
      const { data } = await api.get(`/trainer/my-clients/${customerId}/kpi/`, { headers: authHeaders() });
      set((s) => ({ clientKPIs: { ...s.clientKPIs, [customerId]: data }, kpiLoading: false }));
    } catch {
      set({ kpiLoading: false });
    }
  },

  fetchAlerts: async (params) => {
    set({ alertsLoading: true });
    try {
      const queryParams = new URLSearchParams();
      if (params?.level) queryParams.set('level', params.level);
      const { data } = await api.get(`/trainer/alerts/?${queryParams}`, { headers: authHeaders() });
      set({ alerts: data.alerts, alertsLoading: false });
    } catch {
      set({ alertsLoading: false });
    }
  },

  resolveAlert: async (riskScoreId, payload) => {
    const { data } = await api.post(`/trainer/alerts/${riskScoreId}/resolve/`, payload, { headers: authHeaders() });
    // Optimistically update the alert in state
    set((s) => ({
      alerts: s.alerts.map((a) =>
        a.id === riskScoreId
          ? { ...a, resolutions: [...a.resolutions, data] }
          : a
      ),
    }));
  },

  sendTrainerMessage: async (customerId, message, triggerType = 'manual', triggerRefId) => {
    const body: Record<string, unknown> = {
      customer_id: customerId,
      message,
      trigger_type: triggerType,
    };
    if (triggerRefId !== undefined) body.trigger_ref_id = triggerRefId;
    await api.post('/trainer/messages/', body, { headers: authHeaders() });
    await get().fetchTrainerMessages(customerId);
  },

  fetchTrainerMessages: async (customerId: number) => {
    set({ messagesLoading: true });
    try {
      const { data } = await api.get(`/trainer/messages/?customer_id=${customerId}`, { headers: authHeaders() });
      set((s) => ({ trainerMessages: { ...s.trainerMessages, [customerId]: data.messages }, messagesLoading: false }));
    } catch {
      set({ messagesLoading: false });
    }
  },

  updateTrainerMessage: async (customerId, messageId, message) => {
    const { data } = await api.patch(`/trainer/messages/${messageId}/`, { message }, { headers: authHeaders() });
    set((s) => ({
      trainerMessages: {
        ...s.trainerMessages,
        [customerId]: (s.trainerMessages[customerId] ?? []).map(m =>
          m.id === messageId ? { ...m, message: data.message, trigger_type: data.trigger_type } : m
        ),
      },
    }));
  },

  deleteTrainerMessage: async (customerId, messageId) => {
    await api.delete(`/trainer/messages/${messageId}/`, { headers: authHeaders() });
    set((s) => ({
      trainerMessages: {
        ...s.trainerMessages,
        [customerId]: (s.trainerMessages[customerId] ?? []).filter(m => m.id !== messageId),
      },
    }));
  },

  fetchComparativeMetrics: async () => {
    set({ comparativeLoading: true });
    try {
      const { data } = await api.get('/trainer/comparative-metrics/', { headers: authHeaders() });
      set({ comparativeMetrics: data, comparativeLoading: false });
    } catch {
      set({ comparativeLoading: false });
    }
  },

  fetchClientAlerts: async (customerId: number) => {
    set({ clientAlertsLoading: true });
    try {
      const { data } = await api.get(`/trainer/my-clients/${customerId}/alerts/`, { headers: authHeaders() });
      set((s) => ({ clientAlerts: { ...s.clientAlerts, [customerId]: data.alerts }, clientAlertsLoading: false }));
    } catch {
      set({ clientAlertsLoading: false });
    }
  },

  pauseProgram: async (customerId, programId, reason) => {
    set({ programActionLoading: true });
    try {
      await api.post(
        `/trainer/my-clients/${customerId}/program/${programId}/pause/`,
        { pause_reason: reason },
        { headers: authHeaders() }
      );
      set({ programActionLoading: false });
    } catch {
      set({ programActionLoading: false });
      throw new Error('No se pudo pausar el programa.');
    }
  },

  resumeProgram: async (customerId, programId) => {
    set({ programActionLoading: true });
    try {
      await api.post(
        `/trainer/my-clients/${customerId}/program/${programId}/resume/`,
        {},
        { headers: authHeaders() }
      );
      set({ programActionLoading: false });
    } catch {
      set({ programActionLoading: false });
      throw new Error('No se pudo reanudar el programa.');
    }
  },

  fetchClientDailyLogs: async (customerId, days = 7) => {
    set({ dailyLogsLoading: true });
    try {
      const { data } = await api.get(`/trainer/my-clients/${customerId}/daily-logs/?days=${days}`, { headers: authHeaders() });
      set((s) => ({ clientDailyLogs: { ...s.clientDailyLogs, [customerId]: data.days }, dailyLogsLoading: false }));
    } catch {
      set({ dailyLogsLoading: false });
    }
  },

  fetchClientNutritionLogs: async (customerId, days = 7) => {
    set({ nutritionLogsLoading: true });
    try {
      const { data } = await api.get(`/trainer/my-clients/${customerId}/nutrition-logs/?days=${days}`, { headers: authHeaders() });
      set((s) => ({ clientNutritionLogs: { ...s.clientNutritionLogs, [customerId]: data.days }, nutritionLogsLoading: false }));
    } catch {
      set({ nutritionLogsLoading: false });
    }
  },

  fetchClientSessionsFull: async (customerId) => {
    set({ sessionsFullLoading: true });
    try {
      const { data } = await api.get(`/trainer/my-clients/${customerId}/sessions-full/`, { headers: authHeaders() });
      set((s) => ({ clientSessionsFull: { ...s.clientSessionsFull, [customerId]: data.sessions }, sessionsFullLoading: false }));
    } catch {
      set({ sessionsFullLoading: false });
    }
  },

  updateSessionObjective: async (customerId, bookingId, objective) => {
    try {
      await api.patch(`/bookings/${bookingId}/session-prep/`, { session_objective: objective }, { headers: authHeaders() });
      set((s) => ({
        clientSessionsFull: {
          ...s.clientSessionsFull,
          [customerId]: (s.clientSessionsFull[customerId] ?? []).map(sess =>
            sess.id === bookingId ? { ...sess, session_objective: objective } : sess
          ),
        },
      }));
    } catch {
      // Swallow — surface keeps optimistic state; caller can re-fetch if needed.
    }
  },

  fetchClientMonthlyPrograms: async (customerId) => {
    set({ monthlyProgramsLoading: true });
    try {
      const { data } = await api.get(`/monthly-programs/customer/${customerId}/`, { headers: authHeaders() });
      const programs = (data.programs ?? data ?? []) as ClientMonthlyProgram[];
      set((s) => ({ clientMonthlyPrograms: { ...s.clientMonthlyPrograms, [customerId]: programs }, monthlyProgramsLoading: false }));
    } catch {
      set({ monthlyProgramsLoading: false });
    }
  },

  updateMonthlyProgramNote: async (customerId, programId, notes) => {
    await api.patch(`/monthly-programs/${programId}/note/`, { trainer_notes: notes }, { headers: authHeaders() });
    set((s) => ({
      clientMonthlyPrograms: {
        ...s.clientMonthlyPrograms,
        [customerId]: (s.clientMonthlyPrograms[customerId] ?? []).map(p =>
          p.id === programId ? { ...p, trainer_notes: notes } : p
        ),
      },
    }));
  },

  fetchClientWeeklyPlans: async (customerId) => {
    set({ weeklyPlansLoading: true });
    try {
      const { data } = await api.get(`/nutrition-plans/customer/${customerId}/`, { headers: authHeaders() });
      const plans = (data.plans ?? data ?? []) as ClientWeeklyPlan[];
      set((s) => ({ clientWeeklyPlans: { ...s.clientWeeklyPlans, [customerId]: plans }, weeklyPlansLoading: false }));
    } catch {
      set({ weeklyPlansLoading: false });
    }
  },

  updateWeeklyPlanNote: async (customerId, planId, notes) => {
    await api.patch(`/nutrition-plans/${planId}/note/`, { trainer_notes: notes }, { headers: authHeaders() });
    set((s) => ({
      clientWeeklyPlans: {
        ...s.clientWeeklyPlans,
        [customerId]: (s.clientWeeklyPlans[customerId] ?? []).map(p =>
          p.id === planId ? { ...p, trainer_notes: notes } : p
        ),
      },
    }));
  },
}));
