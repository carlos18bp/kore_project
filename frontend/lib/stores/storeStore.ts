import { create } from 'zustand';
import Cookies from 'js-cookie';
import { api, extractApiError } from '@/lib/services/http';

export type StoreItem = {
  id: number; name: string; description: string; image_url: string | null;
  price_credits: number; item_type: string; is_active: boolean;
};

export type Redemption = {
  id: number; item: number; item_name: string; item_type: string; item_image_url: string | null;
  credits_spent: number; status: 'pending' | 'fulfilled' | 'rejected';
  trainer_note: string; delivery_photo_url: string | null;
  created_at: string; resolved_at: string | null;
};

type StoreState = {
  items: StoreItem[];
  balance: number;
  pendingBalance: number;
  redemptions: Redemption[];
  pendingReviews: (Redemption & { customer_email?: string; customer_name?: string })[];
  loading: boolean;
  error: string;
  fetchCatalog: () => Promise<void>;
  redeem: (itemId: number) => Promise<boolean>;
  fetchMyRedemptions: () => Promise<void>;
  fetchPendingReviews: () => Promise<void>;
  reviewRedemption: (pk: number, decision: 'fulfill' | 'reject', note?: string, deliveryPhoto?: File) => Promise<boolean>;
};

function authHeaders() {
  const token = Cookies.get('kore_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export const useStoreStore = create<StoreState>((set, get) => ({
  items: [], balance: 0, pendingBalance: 0, redemptions: [], pendingReviews: [], loading: false, error: '',

  fetchCatalog: async () => {
    set({ loading: true, error: '' });
    try {
      const { data } = await api.get('/store/items/', { headers: authHeaders() });
      set({ items: data.items ?? [], balance: data.balance ?? 0, pendingBalance: data.pending_balance ?? 0, loading: false });
    } catch {
      set({ error: 'No se pudo cargar la tienda.', loading: false });
    }
  },

  redeem: async (itemId) => {
    set({ error: '' });
    try {
      await api.post('/store/redemptions/', { item_id: itemId }, { headers: authHeaders() });
      await get().fetchCatalog();
      return true;
    } catch (err) {
      set({ error: extractApiError(err, 'No se pudo realizar el canje.') });
      return false;
    }
  },

  fetchMyRedemptions: async () => {
    try {
      const { data } = await api.get('/store/redemptions/', { headers: authHeaders() });
      set({ redemptions: Array.isArray(data) ? data : data.results ?? [] });
    } catch {
      set({ error: 'No se pudo cargar tus canjes.' });
    }
  },

  fetchPendingReviews: async () => {
    try {
      const { data } = await api.get('/trainer/store/redemptions/', { headers: authHeaders() });
      set({ pendingReviews: data.results ?? [] });
    } catch {
      set({ error: 'No se pudieron cargar las solicitudes.' });
    }
  },

  reviewRedemption: async (pk, decision, note, deliveryPhoto) => {
    try {
      let body: FormData | { decision: string; note?: string };
      if (deliveryPhoto) {
        const fd = new FormData();
        fd.append('decision', decision);
        if (note) fd.append('note', note);
        fd.append('delivery_photo', deliveryPhoto);
        body = fd;
      } else {
        body = { decision, note };
      }
      await api.post(`/trainer/store/redemptions/${pk}/review/`, body, { headers: authHeaders() });
      set((s) => ({ pendingReviews: s.pendingReviews.filter((r) => r.id !== pk) }));
      return true;
    } catch (err) {
      set({ error: extractApiError(err, 'No se pudo procesar la solicitud.') });
      return false;
    }
  },
}));
