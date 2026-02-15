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

export type PaymentIntentResult = {
  id: number;
  reference: string;
  wompi_transaction_id: string;
  status: 'pending' | 'approved' | 'failed';
  amount: string;
  currency: string;
  package_title: string;
  created_at: string;
};

type PaymentStatus = 'idle' | 'processing' | 'polling' | 'success' | 'error';

type CheckoutState = {
  package_: PackageDetail | null;
  wompiConfig: WompiConfig | null;
  loading: boolean;
  paymentStatus: PaymentStatus;
  intentResult: PaymentIntentResult | null;
  error: string;
  fetchPackage: (id: string) => Promise<void>;
  fetchWompiConfig: () => Promise<void>;
  purchaseSubscription: (packageId: number, cardToken: string) => Promise<boolean>;
  pollIntentStatus: (reference: string) => Promise<boolean>;
  reset: () => void;
};

const POLL_INTERVAL_MS = 2000;
const POLL_MAX_ATTEMPTS = 30;

export const useCheckoutStore = create<CheckoutState>((set, get) => ({
  package_: null,
  wompiConfig: null,
  loading: false,
  paymentStatus: 'idle',
  intentResult: null,
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
      const { data } = await api.post<PaymentIntentResult>(
        '/subscriptions/purchase/',
        { package_id: packageId, card_token: cardToken },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      set({ intentResult: data, paymentStatus: 'polling' });
      return await get().pollIntentStatus(data.reference);
    } catch (err) {
      const axiosErr = err as AxiosError<{ detail?: string }>;
      const message = axiosErr.response?.data?.detail || 'Error al procesar el pago. Intenta de nuevo.';
      set({ paymentStatus: 'error', error: message });
      return false;
    }
  },

  pollIntentStatus: async (reference: string) => {
    const token = Cookies.get('kore_token');
    for (let attempt = 0; attempt < POLL_MAX_ATTEMPTS; attempt++) {
      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
      try {
        const { data } = await api.get<PaymentIntentResult>(
          `/subscriptions/intent-status/${reference}/`,
          { headers: { Authorization: `Bearer ${token}` } },
        );
        set({ intentResult: data });

        if (data.status === 'approved') {
          set({ paymentStatus: 'success' });
          return true;
        }
        if (data.status === 'failed') {
          set({ paymentStatus: 'error', error: 'El pago fue rechazado. Intenta con otro método de pago.' });
          return false;
        }
      } catch {
        // Ignore transient polling errors, keep trying
      }
    }
    set({ paymentStatus: 'error', error: 'El pago está tardando más de lo esperado. Revisa tu estado en unos minutos.' });
    return false;
  },

  reset: () => {
    set({
      package_: null,
      wompiConfig: null,
      loading: false,
      paymentStatus: 'idle',
      intentResult: null,
      error: '',
    });
  },
}));
