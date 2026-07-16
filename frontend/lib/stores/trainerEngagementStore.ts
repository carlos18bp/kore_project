import { create } from 'zustand';
import { api, extractApiError } from '@/lib/services/http';

export type RosterEntry = {
  customer_id: number;
  name: string;
  current_streak: number;
  last_checkin: string | null;
  attendance_rate_30d: number | null;
  average_rating: number | null;
};

export type EngagementSummary = {
  clients_total: number;
  active_streaks: number;
  checked_in_today: number;
  checked_in_today_pct: number;
  credits_earned_30d: number;
  credits_spent_30d: number;
  attendance_rate_30d: number | null;
};

export type TrainerEngagement = {
  summary: EngagementSummary;
  roster: RosterEntry[];
};

type State = {
  data: TrainerEngagement | null;
  loading: boolean;
  error: string | null;
  fetchEngagement: () => Promise<void>;
};

export const useTrainerEngagementStore = create<State>((set) => ({
  data: null,
  loading: false,
  error: null,
  fetchEngagement: async () => {
    set({ loading: true, error: null });
    try {
      const { data } = await api.get('/trainer/engagement/');
      set({ data: data as TrainerEngagement, loading: false });
    } catch (err) {
      set({ error: extractApiError(err, 'No se pudo cargar el engagement.'), loading: false });
    }
  },
}));
