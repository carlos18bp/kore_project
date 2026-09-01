import { create } from 'zustand';
import Cookies from 'js-cookie';
import { api } from '@/lib/services/http';

export type UpgradeStatus = { reference: string; status: 'pending' | 'approved' | 'declined' };

type State = {
  access: boolean;
  price: number | null;
  loading: boolean;
  fetchNutritionAccess: () => Promise<void>;
  startNutritionUpgrade: () => Promise<string | null>;
  fetchUpgradeStatus: (reference: string) => Promise<UpgradeStatus | null>;
};

function authHeaders() {
  const token = Cookies.get('kore_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export const useNutritionUpgradeStore = create<State>((set) => ({
  access: false, price: null, loading: false,

  fetchNutritionAccess: async () => {
    set({ loading: true });
    try {
      const { data } = await api.get<{ has_nutrition_access: boolean; price_cop: number | null }>('/nutrition/access/', { headers: authHeaders() });
      set({ access: !!data.has_nutrition_access, price: data.price_cop ?? null, loading: false });
    } catch {
      set({ loading: false });
    }
  },

  startNutritionUpgrade: async () => {
    try {
      const { data } = await api.post<{ checkout_url: string }>('/nutrition/upgrade/', {}, { headers: authHeaders() });
      return data.checkout_url;
    } catch {
      return null;
    }
  },

  fetchUpgradeStatus: async (reference) => {
    try {
      const { data } = await api.get<UpgradeStatus>(`/nutrition/upgrade/${reference}/`, { headers: authHeaders() });
      return data;
    } catch {
      return null;
    }
  },
}));
