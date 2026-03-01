import { create } from 'zustand';
import { api } from '@/lib/services/http';
import Cookies from 'js-cookie';

// ----------------------------------------------------------------
// Types
// ----------------------------------------------------------------

export type Trainer = {
  id: number;
  user_id: number;
  first_name: string;
  last_name: string;
  email: string;
  specialty: string;
  bio: string;
  location: string;
  session_duration_minutes: number;
};

export type Slot = {
  id: number;
  trainer_id: number | null;
  starts_at: string;
  ends_at: string;
  is_active: boolean;
  is_blocked: boolean;
};

export type PackageInfo = {
  id: number;
  title: string;
  sessions_count: number;
  session_duration_minutes: number;
  price: string;
  currency: string;
  validity_days: number;
};

export type Subscription = {
  id: number;
  customer_email: string;
  package: PackageInfo;
  sessions_total: number;
  sessions_used: number;
  sessions_remaining: number;
  status: 'active' | 'expired' | 'canceled';
  starts_at: string;
  expires_at: string;
  next_billing_date: string | null;
};

export type BookingData = {
  id: number;
  customer_id: number;
  package: PackageInfo;
  slot: Slot;
  trainer: Trainer | null;
  subscription_id_display: number | null;
  status: 'pending' | 'confirmed' | 'canceled';
  notes: string;
  canceled_reason: string;
  created_at: string;
  updated_at: string;
};

export type PaginatedResponse<T> = {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
};

// ----------------------------------------------------------------
// Store
// ----------------------------------------------------------------

type BookingStep = 1 | 2 | 3;

type BookingState = {
  // Booking flow
  step: BookingStep;
  selectedDate: string | null;
  selectedSlot: Slot | null;
  trainer: Trainer | null;
  subscription: Subscription | null;
  bookingResult: BookingData | null;

  // Data lists
  trainers: Trainer[];
  slots: Slot[];
  monthSlots: Slot[];
  monthSlotsLoading: boolean;
  subscriptions: Subscription[];
  bookings: BookingData[];
  bookingDetail: BookingData | null;
  bookingsPagination: { count: number; next: string | null; previous: string | null };
  upcomingReminder: BookingData | null;

  // Loading
  loading: boolean;
  error: string | null;

  // Actions — flow
  setStep: (step: BookingStep) => void;
  setSelectedDate: (date: string | null) => void;
  setSelectedSlot: (slot: Slot | null) => void;
  reset: () => void;

  // Actions — API
  fetchTrainers: () => Promise<void>;
  fetchSlots: (date?: string, trainerId?: number) => Promise<void>;
  fetchMonthSlots: (trainerId?: number) => Promise<void>;
  fetchSubscriptions: () => Promise<void>;
  fetchBookings: (subscriptionId?: number, page?: number) => Promise<void>;
  fetchBookingById: (bookingId: number) => Promise<BookingData | null>;
  fetchUpcomingReminder: () => Promise<void>;
  createBooking: (payload: {
    package_id: number;
    slot_id: number;
    trainer_id?: number;
    subscription_id?: number;
    notes?: string;
  }) => Promise<BookingData | null>;
  cancelBooking: (bookingId: number, reason?: string) => Promise<BookingData | null>;
  rescheduleBooking: (bookingId: number, newSlotId: number) => Promise<BookingData | null>;
};

function authHeaders() {
  const token = Cookies.get('kore_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function extractErrorMessage(errData: Record<string, unknown> | undefined): string {
  if (!errData) return 'No se pudo crear la reserva.';

  // DRF detail field (string or array)
  if (errData.detail) {
    if (typeof errData.detail === 'string') return errData.detail;
    if (Array.isArray(errData.detail) && typeof errData.detail[0] === 'string') return errData.detail[0];
  }

  // DRF non_field_errors (string or array)
  if (errData.non_field_errors) {
    if (typeof errData.non_field_errors === 'string') return errData.non_field_errors;
    if (Array.isArray(errData.non_field_errors) && typeof errData.non_field_errors[0] === 'string') return errData.non_field_errors[0];
  }

  // Field-specific errors (e.g., slot_id, subscription_id)
  const fieldKeys = ['slot_id', 'subscription_id', 'package_id', 'trainer_id'];
  for (const key of fieldKeys) {
    const val = errData[key];
    if (typeof val === 'string') return val;
    if (Array.isArray(val) && typeof val[0] === 'string') return val[0];
  }

  return 'No se pudo crear la reserva.';
}

export const useBookingStore = create<BookingState>((set, get) => ({
  // Initial state
  step: 1,
  selectedDate: null,
  selectedSlot: null,
  trainer: null,
  subscription: null,
  bookingResult: null,
  trainers: [],
  slots: [],
  monthSlots: [],
  monthSlotsLoading: false,
  subscriptions: [],
  bookings: [],
  bookingDetail: null,
  bookingsPagination: { count: 0, next: null, previous: null },
  upcomingReminder: null,
  loading: false,
  error: null,

  // Flow actions
  setStep: (step) => set({ step }),
  setSelectedDate: (date) => set({ selectedDate: date, selectedSlot: null }),
  setSelectedSlot: (slot) => set({ selectedSlot: slot }),
  reset: () =>
    set({
      step: 1,
      selectedDate: null,
      selectedSlot: null,
      bookingResult: null,
      error: null,
    }),

  // API actions
  fetchTrainers: async () => {
    set({ loading: true, error: null });
    try {
      const { data } = await api.get<PaginatedResponse<Trainer>>('/trainers/', {
        headers: authHeaders(),
      });
      const trainers = data.results ?? data;
      set({ trainers: Array.isArray(trainers) ? trainers : [], trainer: (Array.isArray(trainers) ? trainers[0] : null) ?? null });
    } catch {
      set({ error: 'No se pudieron cargar los entrenadores.' });
    } finally {
      set({ loading: false });
    }
  },

  fetchBookingById: async (bookingId) => {
    const cached = get().bookings.find((booking) => booking.id === bookingId)
      ?? get().bookingDetail;
    if (cached?.id === bookingId) {
      set({ bookingDetail: cached });
      return cached;
    }

    set({ loading: true, error: null });
    try {
      const { data } = await api.get<BookingData>(`/bookings/${bookingId}/`, {
        headers: authHeaders(),
      });
      set({ bookingDetail: data });
      return data;
    } catch {
      set({ error: 'No se pudo cargar la reserva.', bookingDetail: null });
      return null;
    } finally {
      set({ loading: false });
    }
  },

  fetchSlots: async (date, trainerId) => {
    set({ loading: true, error: null });
    try {
      const params: Record<string, string> = {};
      if (date) params.date = date;
      if (trainerId) params.trainer = String(trainerId);
      const { data } = await api.get<PaginatedResponse<Slot>>('/availability-slots/', {
        headers: authHeaders(),
        params,
      });
      const slots = data.results ?? data;
      set({ slots: Array.isArray(slots) ? slots : [] });
    } catch {
      set({ error: 'No se pudieron cargar los horarios.' });
    } finally {
      set({ loading: false });
    }
  },

  fetchMonthSlots: async (trainerId) => {
    const requestId = Date.now() + Math.random();
    set({ monthSlotsLoading: true });
    (useBookingStore as unknown as { _latestMonthSlotsRequestId?: number })._latestMonthSlotsRequestId = requestId;
    try {
      const params: Record<string, string> = {};
      if (trainerId) params.trainer = String(trainerId);
      const aggregated: Slot[] = [];
      let nextUrl: string | null = '/availability-slots/';
      let isFirstRequest = true;

      while (nextUrl) {
        const response: { data: PaginatedResponse<Slot> | Slot[] } = await api.get<
          PaginatedResponse<Slot> | Slot[]
        >(nextUrl, {
          headers: authHeaders(),
          ...(isFirstRequest ? { params } : {}),
        });
        const data: PaginatedResponse<Slot> | Slot[] = response.data;

        if (Array.isArray(data)) {
          aggregated.push(...data);
          break;
        }

        const results = Array.isArray(data.results) ? data.results : [];
        aggregated.push(...results);
        nextUrl = data.next ?? null;
        isFirstRequest = false;
      }

      if ((useBookingStore as unknown as { _latestMonthSlotsRequestId?: number })._latestMonthSlotsRequestId !== requestId) {
        return;
      }
      set({ monthSlots: aggregated });
    } catch {
      if ((useBookingStore as unknown as { _latestMonthSlotsRequestId?: number })._latestMonthSlotsRequestId !== requestId) {
        return;
      }
      set({ monthSlots: [] });
    } finally {
      if ((useBookingStore as unknown as { _latestMonthSlotsRequestId?: number })._latestMonthSlotsRequestId === requestId) {
        set({ monthSlotsLoading: false });
      }
    }
  },

  fetchSubscriptions: async () => {
    set({ loading: true, error: null });
    try {
      const { data } = await api.get<PaginatedResponse<Subscription>>('/subscriptions/', {
        headers: authHeaders(),
      });
      const subs = data.results ?? data;
      set({ subscriptions: Array.isArray(subs) ? subs : [] });
    } catch {
      set({ error: 'No se pudieron cargar las suscripciones.' });
    } finally {
      set({ loading: false });
    }
  },

  fetchBookings: async (subscriptionId, page = 1) => {
    set({ loading: true, error: null });
    try {
      const params: Record<string, string> = { page: String(page) };
      if (subscriptionId) params.subscription = String(subscriptionId);
      const { data } = await api.get<PaginatedResponse<BookingData>>('/bookings/', {
        headers: authHeaders(),
        params,
      });
      set({
        bookings: data.results,
        bookingsPagination: { count: data.count, next: data.next, previous: data.previous },
      });
    } catch {
      set({ error: 'No se pudieron cargar las reservas.' });
    } finally {
      set({ loading: false });
    }
  },

  fetchUpcomingReminder: async () => {
    try {
      const { data } = await api.get<BookingData>('/bookings/upcoming-reminder/', {
        headers: authHeaders(),
      });
      set({ upcomingReminder: data?.id ? data : null });
    } catch {
      set({ upcomingReminder: null });
    }
  },

  createBooking: async (payload) => {
    set({ loading: true, error: null });
    try {
      const { data } = await api.post<BookingData>('/bookings/', payload, {
        headers: authHeaders(),
      });
      set({ bookingResult: data, step: 3 });
      return data;
    } catch (err: unknown) {
      const errData = (err as { response?: { data?: Record<string, unknown> } }).response?.data;
      const msg = extractErrorMessage(errData);
      set({ error: msg });
      return null;
    } finally {
      set({ loading: false });
    }
  },

  cancelBooking: async (bookingId, reason) => {
    set({ loading: true, error: null });
    try {
      const { data } = await api.post<BookingData>(
        `/bookings/${bookingId}/cancel/`,
        reason ? { canceled_reason: reason } : {},
        { headers: authHeaders() },
      );
      if (get().bookingDetail?.id === bookingId) {
        set({ bookingDetail: data });
      }
      return data;
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } }).response?.data?.detail ??
        'No se pudo cancelar la reserva.';
      set({ error: typeof msg === 'string' ? msg : 'No se pudo cancelar la reserva.' });
      return null;
    } finally {
      set({ loading: false });
    }
  },

  rescheduleBooking: async (bookingId, newSlotId) => {
    set({ loading: true, error: null });
    try {
      const { data } = await api.post<BookingData>(
        `/bookings/${bookingId}/reschedule/`,
        { new_slot_id: newSlotId },
        { headers: authHeaders() },
      );
      set({ bookingResult: data, step: 3 });
      return data;
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } }).response?.data?.detail ??
        'No se pudo reprogramar la reserva.';
      set({ error: typeof msg === 'string' ? msg : 'No se pudo reprogramar la reserva.' });
      return null;
    } finally {
      set({ loading: false });
    }
  },
}));
