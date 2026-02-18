import { create } from 'zustand';
import Cookies from 'js-cookie';
import { api } from '@/lib/services/http';
import { AxiosError } from 'axios';
import { useAuthStore } from '@/lib/stores/authStore';

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
  checkout_access_token?: string;
  auto_login?: {
    access: string;
    refresh: string;
    user: {
      id: number;
      email: string;
      first_name: string;
      last_name: string;
      phone: string;
      role: string;
    };
  };
  created_at: string;
};

type PaymentStatus = 'idle' | 'processing' | 'polling' | 'success' | 'error';

type SignatureData = {
  signature: string;
  reference: string;
};

export type CheckoutPreparation = {
  reference: string;
  signature: string;
  amount_in_cents: number;
  currency: string;
  package_title: string;
  checkout_access_token?: string;
};

type CheckoutState = {
  package_: PackageDetail | null;
  wompiConfig: WompiConfig | null;
  loading: boolean;
  paymentStatus: PaymentStatus;
  intentResult: PaymentIntentResult | null;
  error: string;
  fetchPackage: (id: string) => Promise<void>;
  fetchWompiConfig: () => Promise<void>;
  generateSignature: (amountInCents: number, currency: string) => Promise<SignatureData | null>;
  prepareCheckout: (packageId: number, registrationToken?: string) => Promise<CheckoutPreparation | null>;
  purchaseSubscription: (packageId: number, cardToken: string, registrationToken?: string) => Promise<boolean>;
  pollIntentStatus: (reference: string, checkoutAccessToken?: string, transactionId?: string) => Promise<boolean>;
  reset: () => void;
};

const POLL_INTERVAL_MS = 2000;
const POLL_MAX_ATTEMPTS = 30;

function applyAutoLoginSession(autoLogin: NonNullable<PaymentIntentResult['auto_login']>) {
  const first = autoLogin.user.first_name || '';
  const last = autoLogin.user.last_name || '';
  const mappedUser = {
    id: String(autoLogin.user.id),
    email: autoLogin.user.email,
    first_name: first,
    last_name: last,
    phone: autoLogin.user.phone || '',
    role: autoLogin.user.role,
    name: [first, last].filter(Boolean).join(' ') || autoLogin.user.email,
  };

  Cookies.set('kore_token', autoLogin.access, { expires: 7 });
  Cookies.set('kore_refresh', autoLogin.refresh, { expires: 7 });
  Cookies.set('kore_user', JSON.stringify(mappedUser), { expires: 7 });

  useAuthStore.setState({
    user: mappedUser,
    accessToken: autoLogin.access,
    isAuthenticated: true,
    hydrated: true,
    justLoggedIn: true,
  });
}

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
      if (!data?.public_key) {
        set({ wompiConfig: null, error: 'No se pudo cargar la configuración de pago.' });
        return;
      }
      set({ wompiConfig: data });
    } catch {
      set({ error: 'No se pudo cargar la configuración de pago.' });
    }
  },

  generateSignature: async (amountInCents: number, currency: string) => {
    try {
      const token = Cookies.get('kore_token');
      const reference = `kore-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const requestConfig = token
        ? { headers: { Authorization: `Bearer ${token}` } }
        : undefined;
      const { data } = await api.post<SignatureData>(
        '/wompi/generate-signature/',
        { reference, amount_in_cents: amountInCents, currency },
        requestConfig,
      );
      return data;
    } catch {
      set({ error: 'No se pudo generar la firma de pago.' });
      return null;
    }
  },

  prepareCheckout: async (packageId: number, registrationToken?: string) => {
    set({ paymentStatus: 'processing', error: '' });
    try {
      const token = Cookies.get('kore_token');
      const payload: { package_id: number; registration_token?: string } = {
        package_id: packageId,
      };
      if (registrationToken) {
        payload.registration_token = registrationToken;
      }
      const requestConfig = token
        ? { headers: { Authorization: `Bearer ${token}` } }
        : undefined;

      const { data } = await api.post<CheckoutPreparation>(
        '/subscriptions/prepare-checkout/',
        payload,
        requestConfig,
      );
      return data;
    } catch (err) {
      const axiosErr = err as AxiosError<{ detail?: string }>;
      const message = axiosErr.response?.data?.detail || 'No se pudo preparar el pago. Intenta de nuevo.';
      set({ paymentStatus: 'error', error: message });
      return null;
    }
  },

  purchaseSubscription: async (packageId: number, cardToken: string, registrationToken?: string) => {
    set({ paymentStatus: 'processing', error: '' });
    try {
      const token = Cookies.get('kore_token');
      const payload: { package_id: number; card_token: string; registration_token?: string } = {
        package_id: packageId,
        card_token: cardToken,
      };

      if (registrationToken) {
        payload.registration_token = registrationToken;
      }

      const requestConfig = token
        ? { headers: { Authorization: `Bearer ${token}` } }
        : undefined;

      const { data } = await api.post<PaymentIntentResult>(
        '/subscriptions/purchase/',
        payload,
        requestConfig,
      );
      set({ intentResult: data, paymentStatus: 'polling' });
      return await get().pollIntentStatus(data.reference, data.checkout_access_token);
    } catch (err) {
      const axiosErr = err as AxiosError<{ detail?: string }>;
      const message = axiosErr.response?.data?.detail || 'Error al procesar el pago. Intenta de nuevo.';
      set({ paymentStatus: 'error', error: message });
      return false;
    }
  },

  pollIntentStatus: async (reference: string, checkoutAccessToken?: string, transactionId?: string) => {
    const token = Cookies.get('kore_token');
    for (let attempt = 0; attempt < POLL_MAX_ATTEMPTS; attempt++) {
      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
      try {
        const params: Record<string, string> = {};
        if (!token && checkoutAccessToken) {
          params.access_token = checkoutAccessToken;
        }
        if (transactionId) {
          params.transaction_id = transactionId;
        }

        const requestConfig = token
          ? {
            headers: { Authorization: `Bearer ${token}` },
            params: Object.keys(params).length ? params : undefined,
          }
          : Object.keys(params).length
            ? { params }
            : undefined;

        const { data } = await api.get<PaymentIntentResult>(
          `/subscriptions/intent-status/${reference}/`,
          requestConfig,
        );
        set({ intentResult: data });

        if (data.status === 'approved') {
          if (data.auto_login) {
            applyAutoLoginSession(data.auto_login);
          }
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
