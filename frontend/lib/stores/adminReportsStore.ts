import { create } from 'zustand';
import { api, extractApiError } from '@/lib/services/http';

export type ReportWindow = 'today' | '30d' | '90d' | 'all';

export type AdminReport = {
  window: ReportWindow;
  revenue: {
    total_cop: number;
    subscriptions_cop: number;
    credits_cop: number;
    trend: { month: string; cop: number }[];
  };
  subscriptions: {
    active: number;
    expired: number;
    canceled: number;
    with_nutrition: number;
    with_nutrition_pct: number;
  };
  credits: {
    earned: number;
    spent: number;
    redemptions_by_status: Record<string, number>;
  };
  quality: {
    average_score: number;
    rated_count: number;
    distribution: Record<string, number>;
  };
};

type State = {
  window: ReportWindow;
  data: AdminReport | null;
  loading: boolean;
  error: string | null;
  fetchReport: (window: ReportWindow) => Promise<void>;
};

export const useAdminReportsStore = create<State>((set) => ({
  window: '30d',
  data: null,
  loading: false,
  error: null,
  fetchReport: async (window) => {
    set({ loading: true, error: null, window });
    try {
      const { data } = await api.get(`/admin/reports/?window=${window}`);
      set({ data: data as AdminReport, loading: false });
    } catch (err) {
      set({ error: extractApiError(err, 'No se pudieron cargar los reportes.'), loading: false });
    }
  },
}));
