import { create } from 'zustand';
import Cookies from 'js-cookie';
import { api, extractApiError } from '@/lib/services/http';

export type Difficulty = 'easy' | 'medium' | 'hard';

export type TrainerSettings = {
  difficulty: Difficulty;
  action_values: Record<string, number>;
  streak_bonuses: Record<string, number>;
  training_day_threshold: number;
  nutrition_min_meals: number;
  water_goal_glasses: number;
  meal_review_days: number;
  reschedule_window_hours: number;
  require_workout_captures: boolean;
};

type TrainerSettingsState = {
  settings: TrainerSettings | null;
  loading: boolean;
  saving: boolean;
  error: string;

  fetchSettings: () => Promise<void>;
  updateSettings: (patch: Partial<TrainerSettings>) => Promise<boolean>;
};

function authHeaders() {
  const token = Cookies.get('kore_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export const useTrainerSettingsStore = create<TrainerSettingsState>((set) => ({
  settings: null,
  loading: false,
  saving: false,
  error: '',

  fetchSettings: async () => {
    set({ loading: true, error: '' });
    try {
      const { data } = await api.get('/credits/settings/', { headers: authHeaders() });
      set({ settings: data as TrainerSettings, loading: false });
    } catch {
      set({ error: 'No se pudo cargar la configuración.', loading: false });
    }
  },

  // Sending `action_values: {}` alongside a new difficulty is what makes the
  // backend reseed the preset — that emptiness is the signal, not an oversight.
  updateSettings: async (patch) => {
    set({ saving: true, error: '' });
    try {
      const { data } = await api.put('/credits/settings/', patch, { headers: authHeaders() });
      set({ settings: data as TrainerSettings, saving: false });
      return true;
    } catch (err) {
      set({
        error: extractApiError(err, 'No se pudo guardar la configuración.'),
        saving: false,
      });
      return false;
    }
  },
}));
