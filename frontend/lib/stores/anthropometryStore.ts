import { create } from 'zustand';
import Cookies from 'js-cookie';
import { api } from '@/lib/services/http';

export type AnthropometryEvaluation = {
  id: number;
  customer_id: number;
  trainer_name: string;
  weight_kg: string;
  height_cm: string;
  waist_cm: string;
  hip_cm: string;
  perimeters: Record<string, number>;
  skinfolds: Record<string, number>;
  notes: string;
  age_at_evaluation: number;
  bmi: string;
  bmi_category: string;
  bmi_color: string;
  waist_hip_ratio: string;
  whr_risk: string;
  whr_color: string;
  waist_height_ratio: string;
  whe_risk: string;
  whe_color: string;
  body_fat_pct: string;
  bf_category: string;
  bf_color: string;
  bf_method: string;
  fat_mass_kg: string;
  lean_mass_kg: string;
  waist_risk: string;
  waist_risk_color: string;
  sum_skinfolds: string | null;
  asymmetries: Record<string, { d: number; i: number; diff_pct: number }>;
  created_at: string;
};

export type AnthropometryFormData = {
  weight_kg: string;
  height_cm: string;
  waist_cm: string;
  hip_cm: string;
  perimeters: Record<string, string>;
  skinfolds: Record<string, string>;
  notes: string;
};

type AnthropometryState = {
  evaluations: AnthropometryEvaluation[];
  loading: boolean;
  submitting: boolean;
  error: string;
  fetchEvaluations: (clientId: number) => Promise<void>;
  createEvaluation: (clientId: number, data: AnthropometryFormData) => Promise<AnthropometryEvaluation | null>;
  fetchMyEvaluations: () => Promise<void>;
};

function authHeaders() {
  const token = Cookies.get('kore_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export const useAnthropometryStore = create<AnthropometryState>((set) => ({
  evaluations: [],
  loading: false,
  submitting: false,
  error: '',

  fetchEvaluations: async (clientId: number) => {
    set({ loading: true, error: '' });
    try {
      const { data } = await api.get(`/trainer/my-clients/${clientId}/anthropometry/`, {
        headers: authHeaders(),
      });
      set({ evaluations: data, loading: false });
    } catch {
      set({ error: 'No se pudieron cargar las evaluaciones.', loading: false });
    }
  },

  createEvaluation: async (clientId: number, formData: AnthropometryFormData) => {
    set({ submitting: true, error: '' });
    try {
      const payload: Record<string, unknown> = {
        weight_kg: parseFloat(formData.weight_kg),
        height_cm: parseFloat(formData.height_cm),
        waist_cm: parseFloat(formData.waist_cm),
        hip_cm: parseFloat(formData.hip_cm),
        notes: formData.notes || '',
      };
      // Build perimeters JSON (only non-empty values)
      const perimeters: Record<string, number> = {};
      for (const [k, v] of Object.entries(formData.perimeters || {})) {
        if (v && String(v).trim()) perimeters[k] = parseFloat(v);
      }
      payload.perimeters = perimeters;
      // Build skinfolds JSON (only non-empty values)
      const skinfolds: Record<string, number> = {};
      for (const [k, v] of Object.entries(formData.skinfolds || {})) {
        if (v && String(v).trim()) skinfolds[k] = parseFloat(v);
      }
      payload.skinfolds = skinfolds;

      const { data } = await api.post(`/trainer/my-clients/${clientId}/anthropometry/`, payload, {
        headers: authHeaders(),
      });
      set((state) => ({
        evaluations: [data, ...state.evaluations],
        submitting: false,
      }));
      return data;
    } catch (err) {
      const message = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
        || 'No se pudo guardar la evaluación.';
      set({ error: message, submitting: false });
      return null;
    }
  },

  fetchMyEvaluations: async () => {
    set({ loading: true, error: '' });
    try {
      const { data } = await api.get('/my-anthropometry/', {
        headers: authHeaders(),
      });
      set({ evaluations: data, loading: false });
    } catch {
      set({ error: 'No se pudieron cargar tus evaluaciones.', loading: false });
    }
  },
}));
