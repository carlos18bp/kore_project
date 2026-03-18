import { create } from 'zustand';
import Cookies from 'js-cookie';
import { api } from '@/lib/services/http';

export type PhysicalEvaluation = {
  id: number;
  customer_id: number;
  trainer_name: string;
  evaluation_date: string;
  age_at_evaluation: number;
  sex_at_evaluation: string;
  // Raw
  squats_reps: number | null;
  pushups_reps: number | null;
  plank_seconds: number | null;
  walk_meters: number | null;
  unipodal_seconds: number | null;
  hip_mobility: number | null;
  shoulder_mobility: number | null;
  ankle_mobility: number | null;
  // Notes / flags
  squats_notes: string;
  squats_pain: boolean;
  squats_interrupted: boolean;
  pushups_notes: string;
  pushups_pain: boolean;
  plank_notes: string;
  plank_pain: boolean;
  walk_notes: string;
  walk_effort_perception: number | null;
  walk_heart_rate: number | null;
  unipodal_notes: string;
  mobility_notes: string;
  notes: string;
  recommendations: Record<string, { result: string; action: string }>;
  // Scores
  squats_score: number | null;
  pushups_score: number | null;
  plank_score: number | null;
  walk_score: number | null;
  unipodal_score: number | null;
  // Indices
  strength_index: string | null;
  strength_category: string;
  strength_color: string;
  endurance_index: string | null;
  endurance_category: string;
  endurance_color: string;
  mobility_index: string | null;
  mobility_category: string;
  mobility_color: string;
  balance_index: string | null;
  balance_category: string;
  balance_color: string;
  general_index: string | null;
  general_category: string;
  general_color: string;
  // Cross-module
  cross_module_alerts: Record<string, string[]>;
  created_at: string;
};

export type PhysicalEvalFormData = {
  evaluation_date: string;
  squats_reps: number | null;
  pushups_reps: number | null;
  plank_seconds: number | null;
  walk_meters: number | null;
  unipodal_seconds: number | null;
  hip_mobility: number | null;
  shoulder_mobility: number | null;
  ankle_mobility: number | null;
  squats_notes: string;
  squats_pain: boolean;
  squats_interrupted: boolean;
  pushups_notes: string;
  pushups_pain: boolean;
  plank_notes: string;
  plank_pain: boolean;
  walk_notes: string;
  walk_effort_perception: number | null;
  walk_heart_rate: number | null;
  unipodal_notes: string;
  mobility_notes: string;
  notes: string;
};

type PhysicalEvalState = {
  evaluations: PhysicalEvaluation[];
  loading: boolean;
  submitting: boolean;
  error: string;
  fetchEvaluations: (clientId: number) => Promise<void>;
  createEvaluation: (clientId: number, data: PhysicalEvalFormData) => Promise<PhysicalEvaluation | null>;
  updateEvaluation: (clientId: number, evalId: number, data: Partial<PhysicalEvalFormData> & { recommendations?: Record<string, { result: string; action: string }> }) => Promise<PhysicalEvaluation | null>;
  deleteEvaluation: (clientId: number, evalId: number) => Promise<boolean>;
  fetchMyEvaluations: () => Promise<void>;
};

function authHeaders() {
  const token = Cookies.get('kore_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export const usePhysicalEvaluationStore = create<PhysicalEvalState>((set) => ({
  evaluations: [],
  loading: false,
  submitting: false,
  error: '',

  fetchEvaluations: async (clientId: number) => {
    set({ loading: true, error: '' });
    try {
      const { data } = await api.get(`/trainer/my-clients/${clientId}/physical-evaluation/`, {
        headers: authHeaders(),
      });
      set({ evaluations: data, loading: false });
    } catch {
      set({ error: 'No se pudieron cargar las evaluaciones físicas.', loading: false });
    }
  },

  createEvaluation: async (clientId: number, formData: PhysicalEvalFormData) => {
    set({ submitting: true, error: '' });
    try {
      const { data } = await api.post(
        `/trainer/my-clients/${clientId}/physical-evaluation/`,
        formData,
        { headers: authHeaders() },
      );
      set((state) => ({
        evaluations: [data, ...state.evaluations],
        submitting: false,
      }));
      return data;
    } catch (err) {
      const message = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
        || 'No se pudo guardar la evaluación física.';
      set({ error: message, submitting: false });
      return null;
    }
  },

  updateEvaluation: async (clientId: number, evalId: number, data) => {
    set({ submitting: true, error: '' });
    try {
      const { data: updated } = await api.patch(
        `/trainer/my-clients/${clientId}/physical-evaluation/${evalId}/`,
        data,
        { headers: authHeaders() },
      );
      set((state) => ({
        evaluations: state.evaluations.map((ev) => (ev.id === evalId ? updated : ev)),
        submitting: false,
      }));
      return updated;
    } catch {
      set({ error: 'No se pudieron guardar los cambios.', submitting: false });
      return null;
    }
  },

  deleteEvaluation: async (clientId: number, evalId: number) => {
    set({ submitting: true, error: '' });
    try {
      await api.delete(`/trainer/my-clients/${clientId}/physical-evaluation/${evalId}/`, {
        headers: authHeaders(),
      });
      set((state) => ({
        evaluations: state.evaluations.filter((ev) => ev.id !== evalId),
        submitting: false,
      }));
      return true;
    } catch {
      set({ error: 'No se pudo eliminar la evaluación.', submitting: false });
      return false;
    }
  },

  fetchMyEvaluations: async () => {
    set({ loading: true, error: '' });
    try {
      const { data } = await api.get('/my-physical-evaluation/', {
        headers: authHeaders(),
      });
      set({ evaluations: data, loading: false });
    } catch {
      set({ error: 'No se pudieron cargar tus evaluaciones físicas.', loading: false });
    }
  },
}));
