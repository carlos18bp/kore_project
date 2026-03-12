import { create } from 'zustand';
import Cookies from 'js-cookie';
import { api } from '@/lib/services/http';

export type AnthropometryEvaluation = {
  id: number;
  customer_id: number;
  trainer_name: string;
  evaluation_date: string;
  weight_kg: string;
  height_cm: string;
  waist_cm: string | null;
  hip_cm: string | null;
  perimeters: Record<string, number>;
  skinfolds: Record<string, number>;
  notes: string;
  recommendations: Record<string, { result: string; action: string }>;
  age_at_evaluation: number;
  bmi: string;
  bmi_category: string;
  bmi_color: string;
  waist_hip_ratio: string | null;
  whr_risk: string;
  whr_color: string;
  waist_height_ratio: string | null;
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
  evaluation_date: string;
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
  updateEvaluation: (clientId: number, evalId: number, data: { recommendations?: Record<string, { result: string; action: string }>; notes?: string }) => Promise<AnthropometryEvaluation | null>;
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
        evaluation_date: formData.evaluation_date || undefined,
        weight_kg: parseFloat(formData.weight_kg),
        height_cm: parseFloat(formData.height_cm),
        notes: formData.notes || '',
      };
      // Build perimeters JSON (only non-empty values)
      const perimeters: Record<string, number> = {};
      for (const [k, v] of Object.entries(formData.perimeters || {})) {
        if (v && String(v).trim()) perimeters[k] = parseFloat(v);
      }
      payload.perimeters = perimeters;
      // Extract waist/hip from top-level form or from perimeters (cintura/gluteos)
      const waistVal = (formData.waist_cm && formData.waist_cm.trim()) ? formData.waist_cm : String(perimeters.cintura || '');
      const hipVal = (formData.hip_cm && formData.hip_cm.trim()) ? formData.hip_cm : String(perimeters.gluteos || '');
      if (waistVal && waistVal !== '0') payload.waist_cm = parseFloat(waistVal);
      if (hipVal && hipVal !== '0') payload.hip_cm = parseFloat(hipVal);
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

  updateEvaluation: async (clientId: number, evalId: number, data) => {
    set({ submitting: true, error: '' });
    try {
      const { data: updated } = await api.patch(
        `/trainer/my-clients/${clientId}/anthropometry/${evalId}/`,
        data,
        { headers: authHeaders() },
      );
      set((state) => ({
        evaluations: state.evaluations.map((ev) => (ev.id === evalId ? updated : ev)),
        submitting: false,
      }));
      return updated;
    } catch {
      set({ error: 'No se pudieron guardar las recomendaciones.', submitting: false });
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
