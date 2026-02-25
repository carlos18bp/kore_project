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

export type CardTokenData = {
  number: string;
  cvc: string;
  exp_month: string;
  exp_year: string;
  card_holder: string;
};

type WompiTokenResponse = {
  status: string;
  data: {
    id: string;
    created_at: string;
    brand: string;
    name: string;
    last_four: string;
    bin: string;
    exp_year: string;
    exp_month: string;
    card_holder: string;
    expires_at: string;
  };
};

export type PSEPaymentData = {
  financial_institution_code: string;
  user_type: number;
  user_legal_id_type: string;
  user_legal_id: string;
  full_name: string;
  phone_number: string;
};

export type FinancialInstitution = {
  financial_institution_code: string;
  financial_institution_name: string;
};

type CheckoutState = {
  package_: PackageDetail | null;
  wompiConfig: WompiConfig | null;
  loading: boolean;
  paymentStatus: PaymentStatus;
  intentResult: PaymentIntentResult | null;
  redirectUrl: string | null;
  error: string;
  fetchPackage: (id: string) => Promise<void>;
  fetchWompiConfig: () => Promise<void>;
  generateSignature: (amountInCents: number, currency: string) => Promise<SignatureData | null>;
  prepareCheckout: (packageId: number, registrationToken?: string) => Promise<CheckoutPreparation | null>;
  tokenizeCard: (cardData: CardTokenData) => Promise<string | null>;
  purchaseSubscription: (packageId: number, cardToken: string, registrationToken?: string) => Promise<boolean>;
  fetchPSEBanks: () => Promise<FinancialInstitution[]>;
  purchaseWithNequi: (packageId: number, phoneNumber: string, registrationToken?: string) => Promise<boolean>;
  purchaseWithPSE: (packageId: number, pseData: PSEPaymentData, registrationToken?: string) => Promise<boolean>;
  purchaseWithBancolombia: (packageId: number, registrationToken?: string) => Promise<boolean>;
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
  redirectUrl: null,
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

  tokenizeCard: async (cardData: CardTokenData) => {
    const { wompiConfig } = get();
    if (!wompiConfig?.public_key) {
      set({ error: 'Configuración de pago no disponible.' });
      return null;
    }

    const baseUrl = wompiConfig.environment === 'prod'
      ? 'https://production.wompi.co/v1'
      : 'https://sandbox.wompi.co/v1';

    try {
      const response = await fetch(`${baseUrl}/tokens/cards`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${wompiConfig.public_key}`,
        },
        body: JSON.stringify(cardData),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('[Wompi tokenization error]', response.status, errorData);
        const messages = errorData?.error?.messages;
        let errorMessage = 'Error al procesar la tarjeta. Verifica los datos.';
        if (messages) {
          const allErrors = Object.entries(messages)
            .map(([field, msgs]) => `${field}: ${(msgs as string[]).join(', ')}`)
            .join('; ');
          errorMessage = allErrors || errorData?.error?.message || errorMessage;
        } else if (errorData?.error?.message) {
          errorMessage = errorData.error.message;
        }
        set({ error: errorMessage });
        return null;
      }

      const data: WompiTokenResponse = await response.json();
      return data.data.id;
    } catch {
      set({ error: 'No se pudo procesar la tarjeta. Intenta de nuevo.' });
      return null;
    }
  },

  purchaseSubscription: async (packageId: number, cardToken: string, registrationToken?: string) => {
    set({ paymentStatus: 'processing', error: '' });
    try {
      const token = Cookies.get('kore_token');
      const payload: { package_id: number; card_token: string; installments: number; registration_token?: string } = {
        package_id: packageId,
        card_token: cardToken,
        installments: 1,
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

  fetchPSEBanks: async () => {
    const { wompiConfig } = get();
    if (!wompiConfig?.public_key) {
      return [];
    }

    const baseUrl = wompiConfig.environment === 'prod'
      ? 'https://production.wompi.co/v1'
      : 'https://sandbox.wompi.co/v1';

    try {
      const response = await fetch(`${baseUrl}/pse/financial_institutions`, {
        headers: {
          'Authorization': `Bearer ${wompiConfig.public_key}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch banks');
      }

      const data = await response.json();
      return data.data || [];
    } catch {
      return [];
    }
  },

  purchaseWithNequi: async (packageId: number, phoneNumber: string, registrationToken?: string) => {
    set({ paymentStatus: 'processing', error: '' });
    try {
      const token = Cookies.get('kore_token');
      const payload: {
        package_id: number;
        payment_method: string;
        phone_number: string;
        registration_token?: string;
      } = {
        package_id: packageId,
        payment_method: 'NEQUI',
        phone_number: phoneNumber,
      };

      if (registrationToken) {
        payload.registration_token = registrationToken;
      }

      const requestConfig = token
        ? { headers: { Authorization: `Bearer ${token}` } }
        : undefined;

      const { data } = await api.post<PaymentIntentResult & { redirect_url?: string }>(
        '/subscriptions/purchase-alternative/',
        payload,
        requestConfig,
      );
      set({ intentResult: data, paymentStatus: 'polling' });
      return await get().pollIntentStatus(data.reference, data.checkout_access_token);
    } catch (err) {
      const axiosErr = err as AxiosError<{ detail?: string }>;
      const message = axiosErr.response?.data?.detail || 'Error al procesar el pago con Nequi.';
      set({ paymentStatus: 'error', error: message });
      return false;
    }
  },

  purchaseWithPSE: async (packageId: number, pseData: PSEPaymentData, registrationToken?: string) => {
    set({ paymentStatus: 'processing', error: '' });
    try {
      const token = Cookies.get('kore_token');
      const payload: {
        package_id: number;
        payment_method: string;
        pse_data: PSEPaymentData;
        registration_token?: string;
      } = {
        package_id: packageId,
        payment_method: 'PSE',
        pse_data: pseData,
      };

      if (registrationToken) {
        payload.registration_token = registrationToken;
      }

      const requestConfig = token
        ? { headers: { Authorization: `Bearer ${token}` } }
        : undefined;

      const { data } = await api.post<PaymentIntentResult & { redirect_url?: string }>(
        '/subscriptions/purchase-alternative/',
        payload,
        requestConfig,
      );

      if (data.redirect_url) {
        set({ redirectUrl: data.redirect_url, intentResult: data, paymentStatus: 'polling' });
        window.location.href = data.redirect_url;
        return true;
      }

      set({ intentResult: data, paymentStatus: 'polling' });
      return await get().pollIntentStatus(data.reference, data.checkout_access_token);
    } catch (err) {
      const axiosErr = err as AxiosError<{ detail?: string }>;
      const message = axiosErr.response?.data?.detail || 'Error al procesar el pago con PSE.';
      set({ paymentStatus: 'error', error: message });
      return false;
    }
  },

  purchaseWithBancolombia: async (packageId: number, registrationToken?: string) => {
    set({ paymentStatus: 'processing', error: '' });
    try {
      const token = Cookies.get('kore_token');
      const payload: {
        package_id: number;
        payment_method: string;
        registration_token?: string;
      } = {
        package_id: packageId,
        payment_method: 'BANCOLOMBIA_TRANSFER',
      };

      if (registrationToken) {
        payload.registration_token = registrationToken;
      }

      const requestConfig = token
        ? { headers: { Authorization: `Bearer ${token}` } }
        : undefined;

      const { data } = await api.post<PaymentIntentResult & { redirect_url?: string }>(
        '/subscriptions/purchase-alternative/',
        payload,
        requestConfig,
      );

      if (data.redirect_url) {
        set({ redirectUrl: data.redirect_url, intentResult: data, paymentStatus: 'polling' });
        window.location.href = data.redirect_url;
        return true;
      }

      set({ intentResult: data, paymentStatus: 'polling' });
      return await get().pollIntentStatus(data.reference, data.checkout_access_token);
    } catch (err) {
      const axiosErr = err as AxiosError<{ detail?: string }>;
      const message = axiosErr.response?.data?.detail || 'Error al procesar el pago con Bancolombia.';
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
      intentResult: null,
      redirectUrl: null,
      error: '',
    });
  },
}));
