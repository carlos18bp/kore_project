import { create } from 'zustand';
import Cookies from 'js-cookie';
import { api, extractApiError } from '@/lib/services/http';

export type PendingRating = {
  id: number;
  starts_at: string;
  trainer_name: string;
};

export type RatingComment = {
  score: number;
  comment: string;
  customer_name: string;
  created_at: string;
};

export type RatingsSummary = {
  average: number | null;
  count: number;
  recent: RatingComment[];
};

type SessionRatingState = {
  pending: PendingRating[];
  summary: RatingsSummary | null;
  loading: boolean;
  error: string;

  fetchPending: () => Promise<void>;
  submitRating: (bookingId: number, score: number, comment?: string) => Promise<boolean>;
  fetchSummary: (customerId?: number) => Promise<void>;
};

function authHeaders() {
  const token = Cookies.get('kore_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export const useSessionRatingStore = create<SessionRatingState>((set) => ({
  pending: [],
  summary: null,
  loading: false,
  error: '',

  fetchPending: async () => {
    set({ loading: true, error: '' });
    try {
      const { data } = await api.get('/bookings/pending-rating/', { headers: authHeaders() });
      set({ pending: data.results ?? [], loading: false });
    } catch {
      set({ error: 'No se pudieron cargar las sesiones por calificar.', loading: false });
    }
  },

  submitRating: async (bookingId, score, comment) => {
    set({ error: '' });
    try {
      await api.post(
        `/bookings/${bookingId}/rate/`,
        { score, comment: comment ?? '' },
        { headers: authHeaders() },
      );
      set((s) => ({ pending: s.pending.filter((p) => p.id !== bookingId) }));
      return true;
    } catch (err) {
      set({ error: extractApiError(err, 'No se pudo enviar la calificación.') });
      return false;
    }
  },

  fetchSummary: async (customerId) => {
    try {
      const { data } = await api.get('/trainer/ratings/summary/', {
        headers: authHeaders(),
        ...(customerId ? { params: { customer_id: customerId } } : {}),
      });
      set({ summary: data as RatingsSummary });
    } catch {
      set({ error: 'No se pudo cargar el resumen de calificaciones.' });
    }
  },
}));
