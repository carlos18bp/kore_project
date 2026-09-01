import { create } from 'zustand';
import Cookies from 'js-cookie';
import { api, extractApiError } from '@/lib/services/http';

function authHeaders() {
  const token = Cookies.get('kore_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export interface CreditReview {
  id: number;
  action: string;
  amount: number;
  status: string;
  description: string;
  reference_type: string;
  reference_id: string | null;
  review_deadline: string | null;
  created_at: string;
  customer_email: string;
  customer_name: string;
  photo_url: string | null;
  photos: string[];
}

interface TrainerTasksState {
  creditReviews: CreditReview[];
  loading: boolean;
  error: string;
  fetchPendingCreditReviews: () => Promise<void>;
  reviewCreditTransaction: (
    txId: number,
    decision: 'approve' | 'reject',
    note?: string,
  ) => Promise<boolean>;
}

export const useTrainerTasksStore = create<TrainerTasksState>((set) => ({
  creditReviews: [],
  loading: false,
  error: '',
  fetchPendingCreditReviews: async () => {
    set({ loading: true, error: '' });
    try {
      const { data } = await api.get('/trainer/credits/pending-reviews/', {
        headers: authHeaders(),
      });
      set({ creditReviews: data.results ?? [], loading: false });
    } catch {
      set({ error: 'No se pudieron cargar las revisiones.', loading: false });
    }
  },
  reviewCreditTransaction: async (txId, decision, note) => {
    try {
      await api.post(
        `/trainer/credits/transactions/${txId}/review/`,
        { decision, note },
        { headers: authHeaders() },
      );
      set((s) => ({ creditReviews: s.creditReviews.filter((r) => r.id !== txId) }));
      return true;
    } catch (err) {
      set({ error: extractApiError(err, 'No se pudo procesar la revisión.') });
      return false;
    }
  },
}));
