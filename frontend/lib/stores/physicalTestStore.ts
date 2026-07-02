import { create } from 'zustand';
import Cookies from 'js-cookie';
import { api, extractApiError } from '@/lib/services/http';

export type PhysicalTest = {
  id: number;
  customer: number;
  trainer: number | null;
  performed_at: string;
  result: 'passed' | 'failed';
  notes: string;
  created_at: string;
};

export type PhysicalTestFormData = {
  performed_at: string;
  result: 'passed' | 'failed';
  notes: string;
};

type PhysicalTestState = {
  tests: PhysicalTest[];
  loading: boolean;
  submitting: boolean;
  error: string;
  fetchTests: (clientId: number) => Promise<void>;
  createTest: (clientId: number, data: PhysicalTestFormData) => Promise<PhysicalTest | null>;
};

function authHeaders() {
  const token = Cookies.get('kore_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export const usePhysicalTestStore = create<PhysicalTestState>((set) => ({
  tests: [],
  loading: false,
  submitting: false,
  error: '',

  fetchTests: async (clientId: number) => {
    set({ loading: true, error: '' });
    try {
      const { data } = await api.get('/trainer/physical-tests/', {
        headers: authHeaders(),
        params: { customer: clientId },
      });
      const list: PhysicalTest[] = Array.isArray(data) ? data : data.results ?? [];
      set({ tests: list, loading: false });
    } catch {
      set({ error: 'No se pudieron cargar los tests físicos.', loading: false });
    }
  },

  createTest: async (clientId: number, formData: PhysicalTestFormData) => {
    set({ submitting: true, error: '' });
    try {
      const { data } = await api.post(
        '/trainer/physical-tests/',
        { customer: clientId, ...formData },
        { headers: authHeaders() },
      );
      set((state) => ({ tests: [data, ...state.tests], submitting: false }));
      return data;
    } catch (err) {
      set({ error: extractApiError(err, 'No se pudo registrar el test físico.'), submitting: false });
      return null;
    }
  },
}));
