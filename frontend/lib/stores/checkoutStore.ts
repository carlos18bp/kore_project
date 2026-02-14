import { create } from 'zustand';
import Cookies from 'js-cookie';
import { api } from '@/lib/services/http';
import { AxiosError } from 'axios';

export type PackageDetail = {
  id: number;
  title: string;
  description: string;
  sessions_count: number;
  price: string;
  currency: string;
  validity_days: number;
  is_active: boolean;
};

type WompiConfig = {
  public_key: string;
  environment: string;
};

type PurchaseResult = {
  id: number;
  status: string;
  sessions_total: number;
  starts_at: string;
  expires_at: string;
  next_billing_date: string | null;
};

type PaymentStatus = 'idle' | 'processing' | 'success' | 'error';

type CheckoutState = {
  package_: PackageDetail | null;
  wompiConfig: WompiConfig | null;
  loading: boolean;
  paymentStatus: PaymentStatus;
  purchaseResult: PurchaseResult | null;
  error: string;
  fetchPackage: (id: string) => Promise<void>;
  fetchWompiConfig: () => Promise<void>;
  purchaseSubscription: (packageId: number, cardToken: string) => Promise<boolean>;
  reset: () => void;
};

export const useCheckoutStore = create<CheckoutState>((set) => ({
  package_: null,
  wompiConfig: null,
  loading: false,
  paymentStatus: 'idle',
  purchaseResult: null,
  error: '',

  fetchPackage: async (id: string) => {
    set({ loading: true, error: '' });
    try {
      const { data } = await api.get<PackageDetail>(`/packages/${id}/`);
      set({ package_: data, loading: false });
    } catch {
      set({ error: 'No se pudo cargar el paquete.', loading: false });
    }
  },

  fetchWompiConfig: async () => {
    try {
      const { data } = await api.get<WompiConfig>('/wompi/config/');
      set({ wompiConfig: data });
    } catch {
      set({ error: 'No se pudo cargar la configuración de pago.' });
    }
  },

  purchaseSubscription: async (packageId: number, cardToken: string) => {
    set({ paymentStatus: 'processing', error: '' });
    try {
      const token = Cookies.get('kore_token');
      const { data } = await api.post(
        '/subscriptions/purchase/',
        { package_id: packageId, card_token: cardToken },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      set({
        paymentStatus: 'success',
        purchaseResult: data,
      });
      return true;
    } catch (err) {
      const axiosErr = err as AxiosError<{ detail?: string }>;
      const message = axiosErr.response?.data?.detail || 'Error al procesar el pago. Intenta de nuevo.';
      set({ paymentStatus: 'error', error: message });
      return false;
    }
  },

  reset: () => {
    set({
      package_: null,
      wompiConfig: null,
      loading: false,
      paymentStatus: 'idle',
      purchaseResult: null,
      error: '',
    });
  },
}));
