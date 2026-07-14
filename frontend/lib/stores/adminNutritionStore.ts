import { create } from 'zustand';
import Cookies from 'js-cookie';
import { api, extractApiError } from '@/lib/services/http';

export type NutritionProduct = {
  id: number;
  name: string;
  price_cop: number;
  is_active: boolean;
};

export type NutritionProductPayload = {
  price_cop: number;
  is_active: boolean;
};

type AdminNutritionState = {
  product: NutritionProduct | null;
  /** Active subscriptions with nutrition — the blast radius of a price change. */
  activeSubscriptions: number;
  loading: boolean;
  actionLoading: boolean;
  error: string;

  fetchProduct: () => Promise<void>;
  updateProduct: (payload: NutritionProductPayload) => Promise<boolean>;
};

function authHeaders() {
  const token = Cookies.get('kore_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export const useAdminNutritionStore = create<AdminNutritionState>((set) => ({
  product: null,
  activeSubscriptions: 0,
  loading: false,
  actionLoading: false,
  error: '',

  fetchProduct: async () => {
    set({ loading: true, error: '' });
    try {
      const { data } = await api.get('/admin/nutrition-product/', { headers: authHeaders() });
      const { active_nutrition_subscriptions: count, ...product } = data;
      set({
        product: product as NutritionProduct,
        activeSubscriptions: count ?? 0,
        loading: false,
      });
    } catch {
      set({ error: 'No se pudo cargar el precio de nutrición.', loading: false });
    }
  },

  updateProduct: async (payload) => {
    set({ actionLoading: true, error: '' });
    try {
      const { data } = await api.patch('/admin/nutrition-product/', payload, {
        headers: authHeaders(),
      });
      const { active_nutrition_subscriptions: count, ...product } = data;
      set({
        product: product as NutritionProduct,
        activeSubscriptions: count ?? 0,
        actionLoading: false,
      });
      return true;
    } catch (err) {
      set({
        error: extractApiError(err, 'No se pudo guardar el precio de nutrición.'),
        actionLoading: false,
      });
      return false;
    }
  },
}));
