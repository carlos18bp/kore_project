import { create } from 'zustand';
import Cookies from 'js-cookie';
import { api } from '@/lib/services/http';

export type SegmentEntry = {
  is_normal: boolean;
  severity: number;
  sub_fields: Record<string, string | boolean>;
};

export type ViewData = Record<string, SegmentEntry>;

export type SegmentScore = {
  score: number;
  views: Record<string, number>;
  label: string;
  region: string;
};

export type PosturometryEvaluation = {
  id: number;
  customer_id: number;
  trainer_name: string;
  evaluation_date: string;
  anterior_data: ViewData;
  lateral_right_data: ViewData;
  lateral_left_data: ViewData;
  posterior_data: ViewData;
  anterior_photo: string | null;
  lateral_right_photo: string | null;
  lateral_left_photo: string | null;
  posterior_photo: string | null;
  anterior_observations: string;
  lateral_right_observations: string;
  lateral_left_observations: string;
  posterior_observations: string;
  notes: string;
  recommendations: Record<string, { result: string; action: string }>;
  global_index: string;
  global_category: string;
  global_color: string;
  upper_index: string;
  upper_category: string;
  upper_color: string;
  central_index: string;
  central_category: string;
  central_color: string;
  lower_index: string;
  lower_category: string;
  lower_color: string;
  segment_scores: Record<string, SegmentScore>;
  findings: Record<string, string[]>;
  created_at: string;
};

export type PosturometryFormData = {
  evaluation_date: string;
  anterior_data: ViewData;
  lateral_right_data: ViewData;
  lateral_left_data: ViewData;
  posterior_data: ViewData;
  anterior_observations: string;
  lateral_right_observations: string;
  lateral_left_observations: string;
  posterior_observations: string;
  notes: string;
  anterior_photo: File | null;
  lateral_right_photo: File | null;
  lateral_left_photo: File | null;
  posterior_photo: File | null;
};

type PosturometryState = {
  evaluations: PosturometryEvaluation[];
  loading: boolean;
  submitting: boolean;
  error: string;
  fetchEvaluations: (clientId: number) => Promise<void>;
  createEvaluation: (clientId: number, data: PosturometryFormData) => Promise<PosturometryEvaluation | null>;
  updateEvaluation: (clientId: number, evalId: number, data: { recommendations?: Record<string, { result: string; action: string }>; notes?: string }) => Promise<PosturometryEvaluation | null>;
  fetchMyEvaluations: () => Promise<void>;
};

function authHeaders() {
  const token = Cookies.get('kore_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export const usePosturometryStore = create<PosturometryState>((set) => ({
  evaluations: [],
  loading: false,
  submitting: false,
  error: '',

  fetchEvaluations: async (clientId: number) => {
    set({ loading: true, error: '' });
    try {
      const { data } = await api.get(`/trainer/my-clients/${clientId}/posturometry/`, {
        headers: authHeaders(),
      });
      set({ evaluations: data, loading: false });
    } catch {
      set({ error: 'No se pudieron cargar las evaluaciones posturales.', loading: false });
    }
  },

  createEvaluation: async (clientId: number, formData: PosturometryFormData) => {
    set({ submitting: true, error: '' });
    try {
      const fd = new FormData();
      if (formData.evaluation_date) fd.append('evaluation_date', formData.evaluation_date);
      fd.append('anterior_data', JSON.stringify(formData.anterior_data));
      fd.append('lateral_right_data', JSON.stringify(formData.lateral_right_data));
      fd.append('lateral_left_data', JSON.stringify(formData.lateral_left_data));
      fd.append('posterior_data', JSON.stringify(formData.posterior_data));
      fd.append('anterior_observations', formData.anterior_observations || '');
      fd.append('lateral_right_observations', formData.lateral_right_observations || '');
      fd.append('lateral_left_observations', formData.lateral_left_observations || '');
      fd.append('posterior_observations', formData.posterior_observations || '');
      fd.append('notes', formData.notes || '');
      if (formData.anterior_photo) fd.append('anterior_photo', formData.anterior_photo);
      if (formData.lateral_right_photo) fd.append('lateral_right_photo', formData.lateral_right_photo);
      if (formData.lateral_left_photo) fd.append('lateral_left_photo', formData.lateral_left_photo);
      if (formData.posterior_photo) fd.append('posterior_photo', formData.posterior_photo);

      const { data } = await api.post(`/trainer/my-clients/${clientId}/posturometry/`, fd, {
        headers: { ...authHeaders(), 'Content-Type': 'multipart/form-data' },
      });
      set((state) => ({
        evaluations: [data, ...state.evaluations],
        submitting: false,
      }));
      return data;
    } catch (err) {
      const message = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
        || 'No se pudo guardar la evaluación postural.';
      set({ error: message, submitting: false });
      return null;
    }
  },

  updateEvaluation: async (clientId: number, evalId: number, data) => {
    set({ submitting: true, error: '' });
    try {
      const { data: updated } = await api.patch(
        `/trainer/my-clients/${clientId}/posturometry/${evalId}/`,
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
      const { data } = await api.get('/my-posturometry/', {
        headers: authHeaders(),
      });
      set({ evaluations: data, loading: false });
    } catch {
      set({ error: 'No se pudieron cargar tus evaluaciones posturales.', loading: false });
    }
  },
}));
