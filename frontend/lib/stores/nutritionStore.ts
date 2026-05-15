import { create } from 'zustand';
import Cookies from 'js-cookie';
import { api } from '@/lib/services/http';

export type NutritionHabit = {
  id: number;
  customer_id: number;
  meals_per_day: number;
  water_liters: string;
  fruit_weekly: number;
  vegetable_weekly: number;
  protein_frequency: number;
  ultraprocessed_weekly: number;
  sugary_drinks_weekly: number;
  eats_breakfast: boolean;
  notes: string;
  habit_score: string | null;
  habit_category: string;
  habit_color: string;
  trainer_notes: string;
  trainer_approved_at: string | null;
  created_at: string;
};

export type ClientWeeklyPlanNote = {
  id: number;
  status: string;
  week_start: string;
  week_end: string;
  trainer_notes: string;
  approved_at: string | null;
  created_at: string;
  goal: string;
};

export type NutritionFormData = {
  meals_per_day: number;
  water_liters: number;
  fruit_weekly: number;
  vegetable_weekly: number;
  protein_frequency: number;
  ultraprocessed_weekly: number;
  sugary_drinks_weekly: number;
  eats_breakfast: boolean;
  notes: string;
};

type NutritionState = {
  entries: NutritionHabit[];
  loading: boolean;
  submitting: boolean;
  error: string;
  weeklyPlans: ClientWeeklyPlanNote[];
  weeklyPlansLoading: boolean;
  fetchMyEntries: () => Promise<void>;
  createEntry: (data: NutritionFormData) => Promise<NutritionHabit | null>;
  fetchClientEntries: (clientId: number) => Promise<void>;
  approveEntry: (clientId: number, evalId: number, trainerNotes: string) => Promise<void>;
  fetchMyWeeklyPlans: () => Promise<void>;
};

function authHeaders() {
  const token = Cookies.get('kore_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export const useNutritionStore = create<NutritionState>((set) => ({
  entries: [],
  loading: false,
  submitting: false,
  error: '',
  weeklyPlans: [],
  weeklyPlansLoading: false,

  fetchMyEntries: async () => {
    set({ loading: true, error: '' });
    try {
      const { data } = await api.get('/my-nutrition/', {
        headers: authHeaders(),
      });
      set({ entries: data, loading: false });
    } catch {
      set({ error: 'No se pudieron cargar tus registros de nutrición.', loading: false });
    }
  },

  createEntry: async (formData: NutritionFormData) => {
    set({ submitting: true, error: '' });
    try {
      const { data } = await api.post('/my-nutrition/', formData, {
        headers: authHeaders(),
      });
      set((state) => ({
        entries: [data, ...state.entries],
        submitting: false,
      }));
      return data;
    } catch (err) {
      const message = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
        || 'No se pudo guardar el registro de nutrición.';
      set({ error: message, submitting: false });
      return null;
    }
  },

  fetchClientEntries: async (clientId: number) => {
    set({ loading: true, error: '' });
    try {
      const { data } = await api.get(`/trainer/my-clients/${clientId}/nutrition/`, {
        headers: authHeaders(),
      });
      set({ entries: data, loading: false });
    } catch {
      set({ error: 'No se pudieron cargar los registros de nutrición.', loading: false });
    }
  },

  approveEntry: async (clientId: number, evalId: number, trainerNotes: string) => {
    try {
      const { data } = await api.patch(
        `/trainer/my-clients/${clientId}/nutrition/${evalId}/`,
        { trainer_notes: trainerNotes, approve: true },
        { headers: authHeaders() },
      );
      set((s) => ({ entries: s.entries.map((e) => (e.id === evalId ? data : e)) }));
    } catch { /* noop */ }
  },

  fetchMyWeeklyPlans: async () => {
    set({ weeklyPlansLoading: true });
    try {
      const { data } = await api.get<ClientWeeklyPlanNote[]>('/my-nutrition-plans/', {
        headers: authHeaders(),
      });
      set({ weeklyPlans: Array.isArray(data) ? data : [], weeklyPlansLoading: false });
    } catch {
      set({ weeklyPlansLoading: false });
    }
  },
}));
