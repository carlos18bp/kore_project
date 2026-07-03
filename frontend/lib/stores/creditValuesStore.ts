import { create } from 'zustand';
import Cookies from 'js-cookie';
import { api } from '@/lib/services/http';

type CreditValuesState = {
  actionValues: Record<string, number>;
  streakBonuses: Record<string, number>;
  waterGoalGlasses: number;
  requireWorkoutCaptures: boolean;
  loaded: boolean;
  fetchValues: () => Promise<void>;
  value: (action: string) => number | null;
};

function authHeaders() {
  const token = Cookies.get('kore_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export const useCreditValuesStore = create<CreditValuesState>((set, get) => ({
  actionValues: {},
  streakBonuses: {},
  waterGoalGlasses: 8,
  requireWorkoutCaptures: false,
  loaded: false,

  fetchValues: async () => {
    if (get().loaded) return;
    try {
      const { data } = await api.get('/credits/values/', { headers: authHeaders() });
      set({
        actionValues: data.action_values ?? {},
        streakBonuses: data.streak_bonuses ?? {},
        waterGoalGlasses: data.water_goal_glasses ?? 8,
        requireWorkoutCaptures: !!data.require_workout_captures,
        loaded: true,
      });
    } catch {
      // Chips simply stay hidden; retry next session.
    }
  },

  value: (action: string) => {
    const s = get();
    if (!s.loaded) return null;
    const v = s.actionValues[action];
    return typeof v === 'number' ? v : null;
  },
}));
