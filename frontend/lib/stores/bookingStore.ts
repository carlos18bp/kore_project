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
  subscriptions: Subscription[];
  bookings: BookingData[];
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
  fetchSubscriptions: () => Promise<void>;
  fetchBookings: (subscriptionId?: number, page?: number) => Promise<void>;
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
  subscriptions: [],
  bookings: [],
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
      set({ error: 'Error loading trainers.' });
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
      set({ error: 'Error loading slots.' });
    } finally {
      set({ loading: false });
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
      set({ error: 'Error loading subscriptions.' });
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
      set({ error: 'Error loading bookings.' });
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
      const msg =
        (err as { response?: { data?: { detail?: string; non_field_errors?: string } } })
          .response?.data?.detail ??
        (err as { response?: { data?: { non_field_errors?: string } } })
          .response?.data?.non_field_errors ??
        'Error creating booking.';
      set({ error: typeof msg === 'string' ? msg : 'Error creating booking.' });
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
      return data;
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } }).response?.data?.detail ??
        'Error canceling booking.';
      set({ error: typeof msg === 'string' ? msg : 'Error canceling booking.' });
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
      return data;
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } }).response?.data?.detail ??
        'Error rescheduling booking.';
      set({ error: typeof msg === 'string' ? msg : 'Error rescheduling booking.' });
      return null;
    } finally {
      set({ loading: false });
    }
  },
}));
