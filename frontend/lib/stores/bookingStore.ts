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

/** Shape returned by GET /api/availability/ — date keys, arrays of ISO start-time strings. */
export type AvailabilityMap = Record<string, string[]>;

export type PackageInfo = {
  id: number;
  title: string;
  category: string;
  sessions_count: number;
  session_duration_minutes: number;
  price: string;
  currency: string;
  validity_days: number;
};

export type GuestInfo = {
  status: 'pending' | 'accepted' | 'revoked';
  invited_email: string;
  guest_name: string | null;
  guest_user_id: number | null;
};

export type Subscription = {
  id: number;
  customer_email: string;
  package: PackageInfo;
  sessions_total: number;
  sessions_used: number;
  sessions_remaining: number;
  sessions_completed: number;
  status: 'active' | 'expired' | 'canceled';
  starts_at: string;
  expires_at: string;
  next_billing_date: string | null;
  is_recurring: boolean;
  billing_failed_at: string | null;
  pending_package?: PackageInfo | null;
  cancel_at_period_end?: boolean;
  is_guest?: boolean;
  guest_info?: GuestInfo | null;
};

export type SessionGrant = {
  id: number;
  sessions_total: number;
  sessions_used: number;
  sessions_remaining: number;
  expires_at: string;
};

export type ProgramDayExercise = {
  name: string;
  sets: number;
  reps: number | null;
  duration_seconds: number | null;
};

export type BookingData = {
  id: number;
  customer_id: number;
  package: PackageInfo;
  starts_at: string;
  ends_at: string;
  trainer: Trainer | null;
  subscription_id_display: number | null;
  status: 'pending' | 'confirmed' | 'canceled';
  notes: string;
  canceled_reason: string;
  attendance_status: 'unset' | 'attended' | 'no_show';
  attendance_confirmed_at: string | null;
  session_objective: string;
  session_notes_for_customer: string;
  program_day_exercises: ProgramDayExercise[];
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
  selectedStartsAt: string | null;
  trainer: Trainer | null;
  subscription: Subscription | null;
  bookingResult: BookingData | null;

  // Data lists
  trainers: Trainer[];
  availability: AvailabilityMap;
  availabilityLoading: boolean;
  subscriptions: Subscription[];
  sessionGrants: SessionGrant[];
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
  setSelectedStartsAt: (startsAt: string | null) => void;
  setTrainerFromAssigned: (t: { id: number; first_name: string; last_name: string; location: string; session_duration_minutes: number } | null) => void;
  reset: () => void;

  // Actions — API
  fetchTrainers: () => Promise<void>;
  fetchAvailability: (dateFrom?: string, dateTo?: string, trainerId?: number) => Promise<void>;
  fetchSubscriptions: () => Promise<void>;
  fetchSessionGrants: () => Promise<void>;
  fetchBookings: (subscriptionId?: number, page?: number) => Promise<void>;
  fetchBookingById: (bookingId: number) => Promise<BookingData | null>;
  fetchUpcomingReminder: () => Promise<void>;
  createBooking: (payload: {
    package_id: number;
    starts_at: string;
    trainer_id?: number;
    subscription_id?: number;
    session_grant_id?: number;
    customer_id?: number;
    notes?: string;
  }) => Promise<BookingData | null>;
  cancelBooking: (bookingId: number, reason?: string) => Promise<BookingData | null>;
  rescheduleBooking: (bookingId: number, newStartsAt: string) => Promise<BookingData | null>;
  confirmAttendance: (bookingId: number, attended: boolean) => Promise<BookingData | null>;
};

function authHeaders() {
  const token = Cookies.get('kore_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function extractErrorMessage(errData: Record<string, unknown> | undefined): string {
  if (!errData) return 'No se pudo crear la reserva.';

  if (errData.detail) {
    if (typeof errData.detail === 'string') return errData.detail;
    if (Array.isArray(errData.detail) && typeof errData.detail[0] === 'string') return errData.detail[0];
  }

  if (errData.non_field_errors) {
    if (typeof errData.non_field_errors === 'string') return errData.non_field_errors;
    if (Array.isArray(errData.non_field_errors) && typeof errData.non_field_errors[0] === 'string') return errData.non_field_errors[0];
  }

  const fieldKeys = ['starts_at', 'subscription_id', 'session_grant_id', 'package_id', 'trainer_id'];
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
  selectedStartsAt: null,
  trainer: null,
  subscription: null,
  bookingResult: null,
  trainers: [],
  availability: {},
  availabilityLoading: false,
  subscriptions: [],
  sessionGrants: [],
  bookings: [],
  bookingDetail: null,
  bookingsPagination: { count: 0, next: null, previous: null },
  upcomingReminder: null,
  loading: false,
  error: null,

  // Flow actions
  setStep: (step) => set({ step }),
  setSelectedDate: (date) => set({ selectedDate: date, selectedStartsAt: null }),
  setSelectedStartsAt: (startsAt) => set({ selectedStartsAt: startsAt }),
  setTrainerFromAssigned: (t) => {
    if (!t) { set({ trainer: null }); return; }
    set({
      trainer: {
        id: t.id, user_id: 0, first_name: t.first_name, last_name: t.last_name,
        email: '', specialty: '', bio: '', location: t.location,
        session_duration_minutes: t.session_duration_minutes,
      },
    });
  },
  reset: () =>
    set({
      step: 1,
      selectedDate: null,
      selectedStartsAt: null,
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
      set({ trainers: Array.isArray(trainers) ? trainers : [] });
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

  fetchAvailability: async (dateFrom, dateTo, trainerId) => {
    set({ availabilityLoading: true, error: null });
    try {
      const params: Record<string, string> = {};
      if (dateFrom) params.date_from = dateFrom;
      if (dateTo) params.date_to = dateTo;
      if (trainerId) params.trainer = String(trainerId);
      const { data } = await api.get<AvailabilityMap>('/availability/', {
        headers: authHeaders(),
        params,
      });
      set({ availability: typeof data === 'object' && data !== null ? data : {} });
    } catch {
      set({ error: 'No se pudieron cargar los horarios.', availability: {} });
    } finally {
      set({ availabilityLoading: false });
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

  fetchSessionGrants: async () => {
    try {
      const { data } = await api.get<SessionGrant[]>('/session-grants/', { headers: authHeaders() });
      set({ sessionGrants: Array.isArray(data) ? data : [] });
    } catch {
      set({ sessionGrants: [] });
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

  confirmAttendance: async (bookingId, attended) => {
    set({ error: null });
    try {
      const { data } = await api.post<BookingData>(
        `/bookings/${bookingId}/confirm-attendance/`,
        { attended },
        { headers: authHeaders() },
      );
      if (get().bookingDetail?.id === bookingId) {
        set({ bookingDetail: data });
      }
      return data;
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } }).response?.data?.detail ??
        'No se pudo registrar la asistencia.';
      set({ error: typeof msg === 'string' ? msg : 'No se pudo registrar la asistencia.' });
      return null;
    }
  },

  rescheduleBooking: async (bookingId, newStartsAt) => {
    set({ loading: true, error: null });
    try {
      const { data } = await api.post<BookingData>(
        `/bookings/${bookingId}/reschedule/`,
        { new_starts_at: newStartsAt },
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
