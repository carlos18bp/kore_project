import { create } from 'zustand';
import Cookies from 'js-cookie';
import { api } from '@/lib/services/http';

export type CreditPackage = { id: number; name: string; credits: number; price_cop: number };
export type PurchaseStatus = { reference: string; status: 'pending' | 'approved' | 'declined'; credits: number };

type State = {
  packages: CreditPackage[];
  loading: boolean;
  error: string;
  fetchCreditPackages: () => Promise<void>;
  startCreditPurchase: (packageId: number) => Promise<string | null>;
  fetchPurchaseStatus: (reference: string) => Promise<PurchaseStatus | null>;
};

function authHeaders() {
  const token = Cookies.get('kore_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export const useCreditPurchaseStore = create<State>((set) => ({
  packages: [], loading: false, error: '',

  fetchCreditPackages: async () => {
    set({ loading: true, error: '' });
    try {
      const { data } = await api.get<CreditPackage[]>('/credits/packages/', { headers: authHeaders() });
      set({ packages: Array.isArray(data) ? data : [], loading: false });
    } catch {
      set({ error: 'No se pudieron cargar los paquetes.', loading: false });
    }
  },

  startCreditPurchase: async (packageId) => {
    set({ error: '' });
    try {
      const { data } = await api.post<{ reference: string; checkout_url: string }>('/credits/purchases/', { credit_package_id: packageId }, { headers: authHeaders() });
      return data.checkout_url;
    } catch {
      set({ error: 'No se pudo iniciar la compra.' });
      return null;
    }
  },

  fetchPurchaseStatus: async (reference) => {
    try {
      const { data } = await api.get<PurchaseStatus>(`/credits/purchases/${reference}/`, { headers: authHeaders() });
      return data;
    } catch {
      return null;
    }
  },
}));
