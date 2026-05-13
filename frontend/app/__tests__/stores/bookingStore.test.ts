import Cookies from 'js-cookie';
import { useBookingStore } from '@/lib/stores/bookingStore';
import { api } from '@/lib/services/http';

jest.mock('js-cookie', () => ({
  get: jest.fn(),
  set: jest.fn(),
  remove: jest.fn(),
}));

jest.mock('@/lib/services/http', () => ({
  api: {
    get: jest.fn(),
    post: jest.fn(),
  },
}));

const mockedApi = api as jest.Mocked<typeof api>;

function resetStore() {
  useBookingStore.setState({
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
    bookings: [],
    bookingDetail: null,
    bookingsPagination: { count: 0, next: null, previous: null },
    upcomingReminder: null,
    loading: false,
    error: null,
  });
}

const MOCK_TRAINER = {
  id: 1,
  user_id: 10,
  first_name: 'Germán',
  last_name: 'Franco',
  email: 'trainer@kore.com',
  specialty: 'Functional',
  bio: '',
  location: 'Studio A',
  session_duration_minutes: 60,
};

const MOCK_SUBSCRIPTION = {
  id: 2,
  customer_email: 'cust@kore.com',
  package: { id: 1, title: 'Gold', sessions_count: 12, session_duration_minutes: 60, price: '500000', currency: 'COP', validity_days: 30 },
  sessions_total: 12,
  sessions_used: 3,
  sessions_remaining: 9,
  sessions_completed: 3,
  status: 'active' as const,
  starts_at: '2025-02-01T00:00:00Z',
  expires_at: '2025-03-01T00:00:00Z',
  next_billing_date: null,
  is_recurring: false,
  billing_failed_at: null,
};

const MOCK_BOOKING = {
  id: 100,
  customer_id: 22,
  package: MOCK_SUBSCRIPTION.package,
  starts_at: '2025-03-01T10:00:00Z',
  ends_at: '2025-03-01T11:00:00Z',
  trainer: MOCK_TRAINER,
  subscription_id_display: 2,
  status: 'confirmed' as const,
  notes: '',
  canceled_reason: '',
  session_objective: '',
  session_notes_for_customer: '',
  program_day_exercises: [],
  created_at: '2025-02-15T12:00:00Z',
  updated_at: '2025-02-15T12:00:00Z',
};

describe('bookingStore', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    resetStore();
    (Cookies.get as jest.Mock).mockReturnValue('fake-token');
  });

  // ----------------------------------------------------------------
  // Flow actions
  // ----------------------------------------------------------------
  describe('flow actions', () => {
    it('setStep updates step', () => {
      useBookingStore.getState().setStep(2);
      expect(useBookingStore.getState().step).toBe(2);
    });

    it('setSelectedDate sets date and clears selectedStartsAt', () => {
      useBookingStore.setState({ selectedStartsAt: '2025-03-01T10:00:00Z' });
      useBookingStore.getState().setSelectedDate('2025-03-01');
      const state = useBookingStore.getState();
      expect(state.selectedDate).toBe('2025-03-01');
      expect(state.selectedStartsAt).toBeNull();
    });

    it('setSelectedStartsAt sets startsAt', () => {
      useBookingStore.getState().setSelectedStartsAt('2025-03-01T10:00:00Z');
      expect(useBookingStore.getState().selectedStartsAt).toBe('2025-03-01T10:00:00Z');
    });

    it('setTrainerFromAssigned maps assigned trainer to Trainer shape', () => {
      const assigned = { id: 5, first_name: 'Ana', last_name: 'López', location: 'Studio B', session_duration_minutes: 45 };
      useBookingStore.getState().setTrainerFromAssigned(assigned);
      const t = useBookingStore.getState().trainer;
      expect(t).not.toBeNull();
      expect(t!.id).toBe(5);
      expect(t!.first_name).toBe('Ana');
      expect(t!.last_name).toBe('López');
      expect(t!.location).toBe('Studio B');
      expect(t!.session_duration_minutes).toBe(45);
      expect(t!.user_id).toBe(0);
      expect(t!.email).toBe('');
    });

    it('setTrainerFromAssigned sets trainer to null when called with null', () => {
      useBookingStore.setState({ trainer: MOCK_TRAINER });
      useBookingStore.getState().setTrainerFromAssigned(null);
      expect(useBookingStore.getState().trainer).toBeNull();
    });

    it('reset clears flow state', () => {
      useBookingStore.setState({ step: 3, selectedDate: '2025-03-01', selectedStartsAt: '2025-03-01T10:00:00Z', bookingResult: MOCK_BOOKING, error: 'err' });
      useBookingStore.getState().reset();
      const state = useBookingStore.getState();
      expect(state.step).toBe(1);
      expect(state.selectedDate).toBeNull();
      expect(state.selectedStartsAt).toBeNull();
      expect(state.bookingResult).toBeNull();
      expect(state.error).toBeNull();
    });
  });

  // ----------------------------------------------------------------
  // fetchTrainers
  // ----------------------------------------------------------------
  describe('fetchTrainers', () => {
    it('populates trainers from paginated response', async () => {
      mockedApi.get.mockResolvedValueOnce({ data: { results: [MOCK_TRAINER], count: 1, next: null, previous: null } });
      await useBookingStore.getState().fetchTrainers();
      const state = useBookingStore.getState();
      expect(state.trainers).toHaveLength(1);
      expect(state.trainers[0].first_name).toBe('Germán');
      // trainer is NOT auto-selected from fetchTrainers — it is set via setTrainerFromAssigned
      expect(state.trainer).toBeNull();
      expect(state.loading).toBe(false);
    });

    it('populates trainers from flat array response (no results key)', async () => {
      mockedApi.get.mockResolvedValueOnce({ data: [MOCK_TRAINER] });
      await useBookingStore.getState().fetchTrainers();
      const state = useBookingStore.getState();
      expect(state.trainers).toHaveLength(1);
      expect(state.trainer).toBeNull();
    });

    it('sets trainers to empty array for non-array response', async () => {
      mockedApi.get.mockResolvedValueOnce({ data: {} });
      await useBookingStore.getState().fetchTrainers();
      const state = useBookingStore.getState();
      expect(state.trainers).toEqual([]);
    });

    it('does not change trainer state when trainers array is empty', async () => {
      useBookingStore.setState({ trainer: MOCK_TRAINER });
      mockedApi.get.mockResolvedValueOnce({ data: { results: [] } });
      await useBookingStore.getState().fetchTrainers();
      expect(useBookingStore.getState().trainer).toEqual(MOCK_TRAINER);
    });

    it('sends empty auth headers when no token cookie', async () => {
      (Cookies.get as jest.Mock).mockReturnValue(undefined);
      mockedApi.get.mockResolvedValueOnce({ data: { results: [MOCK_TRAINER] } });
      await useBookingStore.getState().fetchTrainers();
      expect(mockedApi.get).toHaveBeenCalledWith('/trainers/', { headers: {} });
    });

    it('sets error on failure', async () => {
      mockedApi.get.mockRejectedValueOnce(new Error('Network'));
      await useBookingStore.getState().fetchTrainers();
      expect(useBookingStore.getState().error).toBe('No se pudieron cargar los entrenadores.');
    });
  });

  // ----------------------------------------------------------------
  // fetchAvailability
  // ----------------------------------------------------------------
  describe('fetchAvailability', () => {
    it('populates availability map and passes trainer param', async () => {
      const map = { '2025-03-01': ['2025-03-01T10:00:00Z', '2025-03-01T11:00:00Z'] };
      mockedApi.get.mockResolvedValueOnce({ data: map });
      await useBookingStore.getState().fetchAvailability(undefined, undefined, 1);
      expect(mockedApi.get).toHaveBeenCalledWith('/availability/', expect.objectContaining({
        params: { trainer: '1' },
      }));
      expect(useBookingStore.getState().availability).toEqual(map);
      expect(useBookingStore.getState().availabilityLoading).toBe(false);
    });

    it('passes date_from and date_to params when provided', async () => {
      mockedApi.get.mockResolvedValueOnce({ data: {} });
      await useBookingStore.getState().fetchAvailability('2025-03-01', '2025-03-31', 1);
      expect(mockedApi.get).toHaveBeenCalledWith('/availability/', expect.objectContaining({
        params: { date_from: '2025-03-01', date_to: '2025-03-31', trainer: '1' },
      }));
    });

    it('sets availability to empty object for non-object response', async () => {
      mockedApi.get.mockResolvedValueOnce({ data: null });
      await useBookingStore.getState().fetchAvailability();
      expect(useBookingStore.getState().availability).toEqual({});
    });

    it('sets error and clears availability on failure', async () => {
      mockedApi.get.mockRejectedValueOnce(new Error('Network'));
      await useBookingStore.getState().fetchAvailability();
      expect(useBookingStore.getState().error).toBe('No se pudieron cargar los horarios.');
      expect(useBookingStore.getState().availability).toEqual({});
      expect(useBookingStore.getState().availabilityLoading).toBe(false);
    });
  });

  // ----------------------------------------------------------------
  // fetchSubscriptions
  // ----------------------------------------------------------------
  describe('fetchSubscriptions', () => {
    it('populates subscriptions', async () => {
      mockedApi.get.mockResolvedValueOnce({ data: { results: [MOCK_SUBSCRIPTION], count: 1, next: null, previous: null } });
      await useBookingStore.getState().fetchSubscriptions();
      expect(useBookingStore.getState().subscriptions).toHaveLength(1);
      expect(useBookingStore.getState().subscriptions[0].status).toBe('active');
    });

    it('populates subscriptions from flat array response', async () => {
      mockedApi.get.mockResolvedValueOnce({ data: [MOCK_SUBSCRIPTION] });
      await useBookingStore.getState().fetchSubscriptions();
      expect(useBookingStore.getState().subscriptions).toHaveLength(1);
    });

    it('sets subscriptions to empty array for non-array response', async () => {
      mockedApi.get.mockResolvedValueOnce({ data: {} });
      await useBookingStore.getState().fetchSubscriptions();
      expect(useBookingStore.getState().subscriptions).toEqual([]);
    });

    it('sets error on failure', async () => {
      mockedApi.get.mockRejectedValueOnce(new Error('Network'));
      await useBookingStore.getState().fetchSubscriptions();
      expect(useBookingStore.getState().error).toBe('No se pudieron cargar las suscripciones.');
      expect(useBookingStore.getState().loading).toBe(false);
    });
  });

  // ----------------------------------------------------------------
  // fetchBookings
  // ----------------------------------------------------------------
  describe('fetchBookings', () => {
    it('populates bookings with pagination metadata', async () => {
      mockedApi.get.mockResolvedValueOnce({
        data: { results: [MOCK_BOOKING], count: 25, next: 'http://x?page=2', previous: null },
      });
      await useBookingStore.getState().fetchBookings(2, 1);
      const state = useBookingStore.getState();
      expect(state.bookings).toHaveLength(1);
      expect(state.bookingsPagination.count).toBe(25);
      expect(state.bookingsPagination.next).toBe('http://x?page=2');
    });

    it('passes subscription filter param', async () => {
      mockedApi.get.mockResolvedValueOnce({ data: { results: [], count: 0, next: null, previous: null } });
      await useBookingStore.getState().fetchBookings(7, 2);
      expect(mockedApi.get).toHaveBeenCalledWith('/bookings/', expect.objectContaining({
        params: { subscription: '7', page: '2' },
      }));
    });

    it('sets error on failure', async () => {
      mockedApi.get.mockRejectedValueOnce(new Error('Network'));
      await useBookingStore.getState().fetchBookings();
      expect(useBookingStore.getState().error).toBe('No se pudieron cargar las reservas.');
      expect(useBookingStore.getState().loading).toBe(false);
    });
  });

  // ----------------------------------------------------------------
  // fetchBookingById
  // ----------------------------------------------------------------
  describe('fetchBookingById', () => {
    it('uses cached booking when available', async () => {
      useBookingStore.setState({ bookings: [MOCK_BOOKING] });
      const result = await useBookingStore.getState().fetchBookingById(100);
      expect(result).toEqual(MOCK_BOOKING);
      expect(useBookingStore.getState().bookingDetail).toEqual(MOCK_BOOKING);
      expect(mockedApi.get).not.toHaveBeenCalled();
    });

    it('fetches booking when not cached', async () => {
      mockedApi.get.mockResolvedValueOnce({ data: MOCK_BOOKING });
      const result = await useBookingStore.getState().fetchBookingById(100);
      expect(result).toEqual(MOCK_BOOKING);
      expect(useBookingStore.getState().bookingDetail).toEqual(MOCK_BOOKING);
      expect(mockedApi.get).toHaveBeenCalledWith('/bookings/100/', {
        headers: { Authorization: 'Bearer fake-token' },
      });
    });

    it('sets error on failure', async () => {
      mockedApi.get.mockRejectedValueOnce(new Error('Network'));
      const result = await useBookingStore.getState().fetchBookingById(100);
      expect(result).toBeNull();
      expect(useBookingStore.getState().bookingDetail).toBeNull();
      expect(useBookingStore.getState().error).toBe('No se pudo cargar la reserva.');
    });
  });

  // ----------------------------------------------------------------
  // fetchUpcomingReminder
  // ----------------------------------------------------------------
  describe('fetchUpcomingReminder', () => {
    it('sets upcomingReminder when booking exists', async () => {
      mockedApi.get.mockResolvedValueOnce({ data: MOCK_BOOKING });
      await useBookingStore.getState().fetchUpcomingReminder();
      expect(useBookingStore.getState().upcomingReminder).toEqual(MOCK_BOOKING);
    });

    it('sets null when response data has no id', async () => {
      mockedApi.get.mockResolvedValueOnce({ data: {} });
      await useBookingStore.getState().fetchUpcomingReminder();
      expect(useBookingStore.getState().upcomingReminder).toBeNull();
    });

    it('sets null when 204 returns empty body', async () => {
      mockedApi.get.mockResolvedValueOnce({ data: '' });
      await useBookingStore.getState().fetchUpcomingReminder();
      expect(useBookingStore.getState().upcomingReminder).toBeNull();
    });

    it('sets null when no upcoming booking (error)', async () => {
      mockedApi.get.mockRejectedValueOnce(new Error('404'));
      await useBookingStore.getState().fetchUpcomingReminder();
      expect(useBookingStore.getState().upcomingReminder).toBeNull();
    });
  });

  // ----------------------------------------------------------------
  // createBooking
  // ----------------------------------------------------------------
  describe('createBooking', () => {
    it('returns booking and sets step to 3 on success', async () => {
      mockedApi.post.mockResolvedValueOnce({ data: MOCK_BOOKING });
      const result = await useBookingStore.getState().createBooking({
        package_id: 1, starts_at: '2025-03-01T10:00:00Z', trainer_id: 1, subscription_id: 2,
      });
      expect(result).toEqual(MOCK_BOOKING);
      const state = useBookingStore.getState();
      expect(state.bookingResult).toEqual(MOCK_BOOKING);
      expect(state.step).toBe(3);
    });

    it('sets error and returns null on failure', async () => {
      mockedApi.post.mockRejectedValueOnce({ response: { data: { detail: 'El horario ya no está disponible.' } } });
      const result = await useBookingStore.getState().createBooking({
        package_id: 1, starts_at: '2025-03-01T10:00:00Z',
      });
      expect(result).toBeNull();
      expect(useBookingStore.getState().error).toBe('El horario ya no está disponible.');
    });

    it('falls back to non_field_errors when no detail', async () => {
      mockedApi.post.mockRejectedValueOnce({ response: { data: { non_field_errors: 'Time conflict.' } } });
      const result = await useBookingStore.getState().createBooking({ package_id: 1, starts_at: '2025-03-01T10:00:00Z' });
      expect(result).toBeNull();
      expect(useBookingStore.getState().error).toBe('Time conflict.');
    });

    it('uses generic error when no response data', async () => {
      mockedApi.post.mockRejectedValueOnce(new Error('Network'));
      const result = await useBookingStore.getState().createBooking({ package_id: 1, starts_at: '2025-03-01T10:00:00Z' });
      expect(result).toBeNull();
      expect(useBookingStore.getState().error).toBe('No se pudo crear la reserva.');
    });

    it('extracts first element when detail is an array', async () => {
      mockedApi.post.mockRejectedValueOnce({ response: { data: { detail: ['array error'] } } });
      const result = await useBookingStore.getState().createBooking({ package_id: 1, starts_at: '2025-03-01T10:00:00Z' });
      expect(result).toBeNull();
      expect(useBookingStore.getState().error).toBe('array error');
    });

    it('extracts first element when non_field_errors is an array', async () => {
      mockedApi.post.mockRejectedValueOnce({ response: { data: { non_field_errors: ['No puedes reservar este horario.'] } } });
      const result = await useBookingStore.getState().createBooking({ package_id: 1, starts_at: '2025-03-01T10:00:00Z' });
      expect(result).toBeNull();
      expect(useBookingStore.getState().error).toBe('No puedes reservar este horario.');
    });

    it('extracts starts_at field error as string', async () => {
      mockedApi.post.mockRejectedValueOnce({ response: { data: { starts_at: 'El horario no está disponible.' } } });
      const result = await useBookingStore.getState().createBooking({ package_id: 1, starts_at: '2025-03-01T10:00:00Z' });
      expect(result).toBeNull();
      expect(useBookingStore.getState().error).toBe('El horario no está disponible.');
    });

    it('extracts starts_at field error from array', async () => {
      mockedApi.post.mockRejectedValueOnce({ response: { data: { starts_at: ['El horario no está activo.'] } } });
      const result = await useBookingStore.getState().createBooking({ package_id: 1, starts_at: '2025-03-01T10:00:00Z' });
      expect(result).toBeNull();
      expect(useBookingStore.getState().error).toBe('El horario no está activo.');
    });

    it('extracts subscription_id field error', async () => {
      mockedApi.post.mockRejectedValueOnce({ response: { data: { subscription_id: ['La suscripción no tiene sesiones disponibles.'] } } });
      const result = await useBookingStore.getState().createBooking({ package_id: 1, starts_at: '2025-03-01T10:00:00Z' });
      expect(result).toBeNull();
      expect(useBookingStore.getState().error).toBe('La suscripción no tiene sesiones disponibles.');
    });

    it('extracts package_id field error', async () => {
      mockedApi.post.mockRejectedValueOnce({ response: { data: { package_id: ['Invalid pk'] } } });
      const result = await useBookingStore.getState().createBooking({ package_id: 999, starts_at: '2025-03-01T10:00:00Z' });
      expect(result).toBeNull();
      expect(useBookingStore.getState().error).toBe('Invalid pk');
    });

    it('uses generic error for unknown field errors', async () => {
      mockedApi.post.mockRejectedValueOnce({ response: { data: { unknown_field: ['Some error'] } } });
      const result = await useBookingStore.getState().createBooking({ package_id: 1, starts_at: '2025-03-01T10:00:00Z' });
      expect(result).toBeNull();
      expect(useBookingStore.getState().error).toBe('No se pudo crear la reserva.');
    });

    it('falls through to generic error when detail is an object', async () => {
      mockedApi.post.mockRejectedValueOnce({ response: { data: { detail: { code: 500 } } } });
      const result = await useBookingStore.getState().createBooking({ package_id: 1, starts_at: '2025-03-01T10:00:00Z' });
      expect(result).toBeNull();
      expect(useBookingStore.getState().error).toBe('No se pudo crear la reserva.');
    });

    it('falls through to generic error when non_field_errors is an object', async () => {
      mockedApi.post.mockRejectedValueOnce({ response: { data: { non_field_errors: { reason: 'x' } } } });
      const result = await useBookingStore.getState().createBooking({ package_id: 1, starts_at: '2025-03-01T10:00:00Z' });
      expect(result).toBeNull();
      expect(useBookingStore.getState().error).toBe('No se pudo crear la reserva.');
    });
  });

  // ----------------------------------------------------------------
  // cancelBooking
  // ----------------------------------------------------------------
  describe('cancelBooking', () => {
    it('returns updated booking on success', async () => {
      const canceled = { ...MOCK_BOOKING, status: 'canceled' as const, canceled_reason: 'Personal' };
      mockedApi.post.mockResolvedValueOnce({ data: canceled });
      const result = await useBookingStore.getState().cancelBooking(100, 'Personal');
      expect(result).toEqual(canceled);
      expect(mockedApi.post).toHaveBeenCalledWith('/bookings/100/cancel/', { canceled_reason: 'Personal' }, expect.anything());
    });

    it('updates bookingDetail when canceling matching booking', async () => {
      const canceled = { ...MOCK_BOOKING, status: 'canceled' as const, canceled_reason: 'Personal' };
      useBookingStore.setState({ bookingDetail: MOCK_BOOKING });
      mockedApi.post.mockResolvedValueOnce({ data: canceled });
      await useBookingStore.getState().cancelBooking(100, 'Personal');
      expect(useBookingStore.getState().bookingDetail).toEqual(canceled);
    });

    it('sets error on 24h policy violation', async () => {
      mockedApi.post.mockRejectedValueOnce({ response: { data: { detail: 'No puedes cancelar con menos de 24 horas de anticipación.' } } });
      const result = await useBookingStore.getState().cancelBooking(100);
      expect(result).toBeNull();
      expect(useBookingStore.getState().error).toBe('No puedes cancelar con menos de 24 horas de anticipación.');
    });

    it('uses generic error when no detail in response', async () => {
      mockedApi.post.mockRejectedValueOnce(new Error('Network'));
      const result = await useBookingStore.getState().cancelBooking(100);
      expect(result).toBeNull();
      expect(useBookingStore.getState().error).toBe('No se pudo cancelar la reserva.');
    });

    it('uses generic error when detail is not a string', async () => {
      mockedApi.post.mockRejectedValueOnce({ response: { data: { detail: ['array error'] } } });
      const result = await useBookingStore.getState().cancelBooking(100);
      expect(result).toBeNull();
      expect(useBookingStore.getState().error).toBe('No se pudo cancelar la reserva.');
    });

    it('sends empty body when no reason provided', async () => {
      const canceled = { ...MOCK_BOOKING, status: 'canceled' as const };
      mockedApi.post.mockResolvedValueOnce({ data: canceled });
      await useBookingStore.getState().cancelBooking(100);
      expect(mockedApi.post).toHaveBeenCalledWith('/bookings/100/cancel/', {}, expect.anything());
    });
  });

  // ----------------------------------------------------------------
  // rescheduleBooking
  // ----------------------------------------------------------------
  describe('rescheduleBooking', () => {
    it('returns new booking on success', async () => {
      const newBooking = { ...MOCK_BOOKING, id: 101, starts_at: '2025-04-01T10:00:00Z' };
      mockedApi.post.mockResolvedValueOnce({ data: newBooking });
      const result = await useBookingStore.getState().rescheduleBooking(100, '2025-04-01T10:00:00Z');
      expect(result).toEqual(newBooking);
      expect(useBookingStore.getState().bookingResult).toEqual(newBooking);
      expect(useBookingStore.getState().step).toBe(3);
      expect(mockedApi.post).toHaveBeenCalledWith('/bookings/100/reschedule/', { new_starts_at: '2025-04-01T10:00:00Z' }, expect.anything());
    });

    it('sets error on failure', async () => {
      mockedApi.post.mockRejectedValueOnce({ response: { data: { detail: 'No se pudo reprogramar la reserva.' } } });
      const result = await useBookingStore.getState().rescheduleBooking(100, '2025-04-01T10:00:00Z');
      expect(result).toBeNull();
      expect(useBookingStore.getState().error).toBe('No se pudo reprogramar la reserva.');
    });

    it('uses generic error when no detail in response', async () => {
      mockedApi.post.mockRejectedValueOnce(new Error('Network'));
      const result = await useBookingStore.getState().rescheduleBooking(100, '2025-04-01T10:00:00Z');
      expect(result).toBeNull();
      expect(useBookingStore.getState().error).toBe('No se pudo reprogramar la reserva.');
    });

    it('uses generic error when detail is not a string', async () => {
      mockedApi.post.mockRejectedValueOnce({ response: { data: { detail: ['array error'] } } });
      const result = await useBookingStore.getState().rescheduleBooking(100, '2025-04-01T10:00:00Z');
      expect(result).toBeNull();
      expect(useBookingStore.getState().error).toBe('No se pudo reprogramar la reserva.');
    });
  });

  // ----------------------------------------------------------------
  // race conditions
  // ----------------------------------------------------------------
  describe('race conditions', () => {
    it('handles time taken between fetchAvailability and createBooking gracefully', async () => {
      // 1. fetchAvailability returns a free slot
      mockedApi.get.mockResolvedValueOnce({ data: { '2025-03-01': ['2025-03-01T10:00:00Z'] } });
      await useBookingStore.getState().fetchAvailability(undefined, undefined, 1);
      expect(useBookingStore.getState().availability['2025-03-01']).toHaveLength(1);

      // 2. createBooking is rejected because the backend confirms it was taken
      mockedApi.post.mockRejectedValueOnce({
        response: { data: { starts_at: ['El horario ya no está disponible.'] } },
      });
      const result = await useBookingStore.getState().createBooking({
        package_id: 1, starts_at: '2025-03-01T10:00:00Z', trainer_id: 1, subscription_id: 2,
      });

      expect(result).toBeNull();
      expect(useBookingStore.getState().error).toBe('El horario ya no está disponible.');
      expect(useBookingStore.getState().bookingResult).toBeNull();
    });

    it('two overlapping fetchAvailability calls leave the store in a consistent state', async () => {
      const MAP_A = { '2025-03-01': ['2025-03-01T10:00:00Z'] };
      const MAP_B = { '2025-03-02': ['2025-03-02T10:00:00Z', '2025-03-02T11:00:00Z'] };

      mockedApi.get
        .mockResolvedValueOnce({ data: MAP_A })
        .mockResolvedValueOnce({ data: MAP_B });

      const promiseA = useBookingStore.getState().fetchAvailability(undefined, undefined, 1);
      const promiseB = useBookingStore.getState().fetchAvailability(undefined, undefined, 1);

      await Promise.all([promiseA, promiseB]);

      const state = useBookingStore.getState();
      expect(typeof state.availability).toBe('object');
      expect(state.availabilityLoading).toBe(false);
      // One of the two responses won — the map matches one of them
      const matchesA = JSON.stringify(state.availability) === JSON.stringify(MAP_A);
      const matchesB = JSON.stringify(state.availability) === JSON.stringify(MAP_B);
      expect(matchesA || matchesB).toBe(true);
    });
  });
});
