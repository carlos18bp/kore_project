import { create } from 'zustand';
import Cookies from 'js-cookie';
import { api, getWithRetry } from '@/lib/services/http';

export type ParqAssessment = {
  id: number;
  customer_id: number;
  q1_heart_condition: boolean;
  q2_chest_pain: boolean;
  q3_dizziness: boolean;
  q4_chronic_condition: boolean;
  q5_prescribed_medication: boolean;
  q6_bone_joint_problem: boolean;
  q7_medical_supervision: boolean;
  additional_notes: string;
  yes_count: number;
  risk_classification: string;
  risk_label: string;
  risk_color: string;
  created_at: string;
};

export type ParqFormData = {
  q1_heart_condition: boolean;
  q2_chest_pain: boolean;
  q3_dizziness: boolean;
  q4_chronic_condition: boolean;
  q5_prescribed_medication: boolean;
  q6_bone_joint_problem: boolean;
  q7_medical_supervision: boolean;
  additional_notes: string;
};

type ParqState = {
  assessments: ParqAssessment[];
  loading: boolean;
  loaded: boolean;
  submitting: boolean;
  error: string;
  fetchMyAssessments: () => Promise<void>;
  createAssessment: (data: ParqFormData) => Promise<ParqAssessment | null>;
  fetchClientAssessments: (clientId: number) => Promise<void>;
  updateNotes: (clientId: number, evalId: number, notes: string) => Promise<void>;
};

function authHeaders() {
  const token = Cookies.get('kore_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export const useParqStore = create<ParqState>((set) => ({
  assessments: [],
  loading: false,
  loaded: false,
  submitting: false,
  error: '',

  fetchMyAssessments: async () => {
    set({ loading: true, error: '' });
    try {
      const { data } = await getWithRetry<ParqAssessment[]>('/my-parq/', {
        headers: authHeaders(),
      });
      set({ assessments: data, loading: false, loaded: true });
    } catch {
      set({ error: 'No se pudieron cargar tus evaluaciones PAR-Q.', loading: false });
    }
  },

  createAssessment: async (formData: ParqFormData) => {
    set({ submitting: true, error: '' });
    try {
      const { data } = await api.post('/my-parq/', formData, {
        headers: authHeaders(),
      });
      set((state) => ({
        assessments: [data, ...state.assessments],
        submitting: false,
      }));
      return data;
    } catch (err) {
      const message = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
        || 'No se pudo guardar la evaluación PAR-Q.';
      set({ error: message, submitting: false });
      return null;
    }
  },

  fetchClientAssessments: async (clientId: number) => {
    set({ loading: true, error: '' });
    try {
      const { data } = await api.get(`/trainer/my-clients/${clientId}/parq/`, {
        headers: authHeaders(),
      });
      set({ assessments: data, loading: false });
    } catch {
      set({ error: 'No se pudieron cargar las evaluaciones PAR-Q.', loading: false });
    }
  },

  updateNotes: async (clientId: number, evalId: number, notes: string) => {
    try {
      const { data } = await api.patch(
        `/trainer/my-clients/${clientId}/parq/${evalId}/`,
        { additional_notes: notes },
        { headers: authHeaders() },
      );
      set((s) => ({ assessments: s.assessments.map(a => a.id === evalId ? data : a) }));
    } catch { /* noop */ }
  },
}));
