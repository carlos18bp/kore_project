import { create } from 'zustand';
import Cookies from 'js-cookie';
import { api } from '@/lib/services/http';

type CreditValuesState = {
  actionValues: Record<string, number>;
  streakBonuses: Record<string, number>;
  waterGoalGlasses: number;
  requireWorkoutCaptures: boolean;
  /** The window that blocks a late cancel/reschedule. 24 until the API answers. */
  rescheduleWindowHours: number;
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
  rescheduleWindowHours: 24,
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
        // Keep 24 if the field is missing: that is what the backend enforces by
        // default, so the buttons never enable on something the API will reject.
        rescheduleWindowHours: data.reschedule_window_hours ?? 24,
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
