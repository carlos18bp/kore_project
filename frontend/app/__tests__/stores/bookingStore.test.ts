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

const mockedCookies = Cookies as jest.Mocked<typeof Cookies>;
const mockedApi = api as jest.Mocked<typeof api>;

function resetStore() {
  useBookingStore.setState({
    step: 1,
    selectedDate: null,
    selectedSlot: null,
    trainer: null,
    subscription: null,
    bookingResult: null,
    trainers: [],
    slots: [],
    monthSlots: [],
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

const MOCK_SLOT = {
  id: 5,
  trainer_id: 1,
  starts_at: '2025-03-01T10:00:00Z',
  ends_at: '2025-03-01T11:00:00Z',
  is_active: true,
  is_blocked: false,
};

const MOCK_SUBSCRIPTION = {
  id: 2,
  customer_email: 'cust@kore.com',
  package: { id: 1, title: 'Gold', sessions_count: 12, session_duration_minutes: 60, price: '500000', currency: 'COP', validity_days: 30 },
  sessions_total: 12,
  sessions_used: 3,
  sessions_remaining: 9,
  status: 'active' as const,
  starts_at: '2025-02-01T00:00:00Z',
  expires_at: '2025-03-01T00:00:00Z',
};

const MOCK_BOOKING = {
  id: 100,
  customer_id: 22,
  package: MOCK_SUBSCRIPTION.package,
  slot: MOCK_SLOT,
  trainer: MOCK_TRAINER,
  subscription_id_display: 2,
  status: 'confirmed' as const,
  notes: '',
  canceled_reason: '',
  created_at: '2025-02-15T12:00:00Z',
  updated_at: '2025-02-15T12:00:00Z',
};

describe('bookingStore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetStore();
    mockedCookies.get.mockReturnValue('fake-token');
  });

  // ----------------------------------------------------------------
  // Flow actions
  // ----------------------------------------------------------------
  describe('flow actions', () => {
    it('setStep updates step', () => {
      useBookingStore.getState().setStep(2);
      expect(useBookingStore.getState().step).toBe(2);
    });

    it('setSelectedDate sets date and clears slot', () => {
      useBookingStore.setState({ selectedSlot: MOCK_SLOT });
      useBookingStore.getState().setSelectedDate('2025-03-01');
      const state = useBookingStore.getState();
      expect(state.selectedDate).toBe('2025-03-01');
      expect(state.selectedSlot).toBeNull();
    });

    it('setSelectedSlot sets slot', () => {
      useBookingStore.getState().setSelectedSlot(MOCK_SLOT);
      expect(useBookingStore.getState().selectedSlot).toEqual(MOCK_SLOT);
    });

    it('reset clears flow state', () => {
      useBookingStore.setState({ step: 3, selectedDate: '2025-03-01', selectedSlot: MOCK_SLOT, bookingResult: MOCK_BOOKING, error: 'err' });
      useBookingStore.getState().reset();
      const state = useBookingStore.getState();
      expect(state.step).toBe(1);
      expect(state.selectedDate).toBeNull();
      expect(state.selectedSlot).toBeNull();
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
      expect(state.trainer).toEqual(MOCK_TRAINER);
      expect(state.loading).toBe(false);
    });

    it('populates trainers from flat array response (no results key)', async () => {
      mockedApi.get.mockResolvedValueOnce({ data: [MOCK_TRAINER] });
      await useBookingStore.getState().fetchTrainers();
      const state = useBookingStore.getState();
      expect(state.trainers).toHaveLength(1);
      expect(state.trainer).toEqual(MOCK_TRAINER);
    });

    it('sets trainers to empty array and trainer to null for non-array response', async () => {
      mockedApi.get.mockResolvedValueOnce({ data: {} });
      await useBookingStore.getState().fetchTrainers();
      const state = useBookingStore.getState();
      expect(state.trainers).toEqual([]);
      expect(state.trainer).toBeNull();
    });

    it('sets trainer to null when trainers array is empty', async () => {
      mockedApi.get.mockResolvedValueOnce({ data: { results: [] } });
      await useBookingStore.getState().fetchTrainers();
      expect(useBookingStore.getState().trainer).toBeNull();
    });

    it('sends empty auth headers when no token cookie', async () => {
      mockedCookies.get.mockReturnValue(undefined);
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
  // fetchSlots
  // ----------------------------------------------------------------
  describe('fetchSlots', () => {
    it('populates slots and passes date param', async () => {
      mockedApi.get.mockResolvedValueOnce({ data: { results: [MOCK_SLOT], count: 1, next: null, previous: null } });
      await useBookingStore.getState().fetchSlots('2025-03-01', 1);
      expect(mockedApi.get).toHaveBeenCalledWith('/availability-slots/', expect.objectContaining({
        params: { date: '2025-03-01', trainer: '1' },
      }));
      expect(useBookingStore.getState().slots).toHaveLength(1);
    });

    it('populates slots from flat array response', async () => {
      mockedApi.get.mockResolvedValueOnce({ data: [MOCK_SLOT] });
      await useBookingStore.getState().fetchSlots();
      expect(useBookingStore.getState().slots).toHaveLength(1);
    });

    it('sets slots to empty array for non-array response', async () => {
      mockedApi.get.mockResolvedValueOnce({ data: {} });
      await useBookingStore.getState().fetchSlots();
      expect(useBookingStore.getState().slots).toEqual([]);
    });

    it('sets error on failure', async () => {
      mockedApi.get.mockRejectedValueOnce(new Error('err'));
      await useBookingStore.getState().fetchSlots();
      expect(useBookingStore.getState().error).toBe('No se pudieron cargar los horarios.');
    });
  });

  // ----------------------------------------------------------------
  // fetchMonthSlots
  // ----------------------------------------------------------------
  describe('fetchMonthSlots', () => {
    it('aggregates paginated month slots', async () => {
      const secondSlot = {
        ...MOCK_SLOT,
        id: 6,
        starts_at: '2025-03-02T10:00:00Z',
        ends_at: '2025-03-02T11:00:00Z',
      };
      mockedApi.get
        .mockResolvedValueOnce({
          data: { results: [MOCK_SLOT], count: 2, next: '/availability-slots/?page=2', previous: null },
        })
        .mockResolvedValueOnce({
          data: { results: [secondSlot], count: 2, next: null, previous: '/availability-slots/?page=1' },
        });
      await useBookingStore.getState().fetchMonthSlots(1);
      expect(mockedApi.get).toHaveBeenNthCalledWith(1, '/availability-slots/', expect.objectContaining({
        params: { trainer: '1' },
      }));
      expect(mockedApi.get).toHaveBeenNthCalledWith(2, '/availability-slots/?page=2', expect.objectContaining({
        headers: { Authorization: 'Bearer fake-token' },
      }));
      expect(useBookingStore.getState().monthSlots).toEqual([MOCK_SLOT, secondSlot]);
    });

    it('populates monthSlots from flat array response', async () => {
      mockedApi.get.mockResolvedValueOnce({ data: [MOCK_SLOT] });
      await useBookingStore.getState().fetchMonthSlots(1);
      expect(mockedApi.get).toHaveBeenCalledWith('/availability-slots/', expect.objectContaining({
        params: { trainer: '1' },
      }));
      expect(useBookingStore.getState().monthSlots).toHaveLength(1);
    });

    it('fetches without trainer param when trainerId is undefined', async () => {
      mockedApi.get.mockResolvedValueOnce({ data: { results: [MOCK_SLOT] } });
      await useBookingStore.getState().fetchMonthSlots();
      expect(mockedApi.get).toHaveBeenCalledWith('/availability-slots/', expect.objectContaining({
        params: {},
      }));
      expect(useBookingStore.getState().monthSlots).toHaveLength(1);
    });

    it('sets monthSlots to empty array on error', async () => {
      mockedApi.get.mockRejectedValueOnce(new Error('Network'));
      await useBookingStore.getState().fetchMonthSlots();
      expect(useBookingStore.getState().monthSlots).toEqual([]);
    });

    it('sets monthSlots to empty array for non-array response', async () => {
      mockedApi.get.mockResolvedValueOnce({ data: {} });
      await useBookingStore.getState().fetchMonthSlots();
      expect(useBookingStore.getState().monthSlots).toEqual([]);
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
        package_id: 1, slot_id: 5, trainer_id: 1, subscription_id: 2,
      });
      expect(result).toEqual(MOCK_BOOKING);
      const state = useBookingStore.getState();
      expect(state.bookingResult).toEqual(MOCK_BOOKING);
      expect(state.step).toBe(3);
    });

    it('sets error and returns null on failure', async () => {
      mockedApi.post.mockRejectedValueOnce({ response: { data: { detail: 'Slot already booked.' } } });
      const result = await useBookingStore.getState().createBooking({
        package_id: 1, slot_id: 5,
      });
      expect(result).toBeNull();
      expect(useBookingStore.getState().error).toBe('Slot already booked.');
    });

    it('falls back to non_field_errors when no detail', async () => {
      mockedApi.post.mockRejectedValueOnce({ response: { data: { non_field_errors: 'Time conflict.' } } });
      const result = await useBookingStore.getState().createBooking({ package_id: 1, slot_id: 5 });
      expect(result).toBeNull();
      expect(useBookingStore.getState().error).toBe('Time conflict.');
    });

    it('uses generic error when no response data', async () => {
      mockedApi.post.mockRejectedValueOnce(new Error('Network'));
      const result = await useBookingStore.getState().createBooking({ package_id: 1, slot_id: 5 });
      expect(result).toBeNull();
      expect(useBookingStore.getState().error).toBe('No se pudo crear la reserva.');
    });

    it('extracts first element when detail is an array', async () => {
      mockedApi.post.mockRejectedValueOnce({ response: { data: { detail: ['array error'] } } });
      const result = await useBookingStore.getState().createBooking({ package_id: 1, slot_id: 5 });
      expect(result).toBeNull();
      expect(useBookingStore.getState().error).toBe('array error');
    });

    it('extracts first element when non_field_errors is an array', async () => {
      mockedApi.post.mockRejectedValueOnce({ response: { data: { non_field_errors: ['No puedes reservar este horario.'] } } });
      const result = await useBookingStore.getState().createBooking({ package_id: 1, slot_id: 5 });
      expect(result).toBeNull();
      expect(useBookingStore.getState().error).toBe('No puedes reservar este horario.');
    });

    it('extracts slot_id field error as string', async () => {
      mockedApi.post.mockRejectedValueOnce({ response: { data: { slot_id: 'El horario está bloqueado.' } } });
      const result = await useBookingStore.getState().createBooking({ package_id: 1, slot_id: 5 });
      expect(result).toBeNull();
      expect(useBookingStore.getState().error).toBe('El horario está bloqueado.');
    });

    it('extracts slot_id field error from array', async () => {
      mockedApi.post.mockRejectedValueOnce({ response: { data: { slot_id: ['El horario no está activo.'] } } });
      const result = await useBookingStore.getState().createBooking({ package_id: 1, slot_id: 5 });
      expect(result).toBeNull();
      expect(useBookingStore.getState().error).toBe('El horario no está activo.');
    });

    it('extracts subscription_id field error', async () => {
      mockedApi.post.mockRejectedValueOnce({ response: { data: { subscription_id: ['La suscripción no tiene sesiones disponibles.'] } } });
      const result = await useBookingStore.getState().createBooking({ package_id: 1, slot_id: 5 });
      expect(result).toBeNull();
      expect(useBookingStore.getState().error).toBe('La suscripción no tiene sesiones disponibles.');
    });

    it('extracts package_id field error', async () => {
      mockedApi.post.mockRejectedValueOnce({ response: { data: { package_id: ['Invalid pk'] } } });
      const result = await useBookingStore.getState().createBooking({ package_id: 999, slot_id: 5 });
      expect(result).toBeNull();
      expect(useBookingStore.getState().error).toBe('Invalid pk');
    });

    it('uses generic error for unknown field errors', async () => {
      mockedApi.post.mockRejectedValueOnce({ response: { data: { unknown_field: ['Some error'] } } });
      const result = await useBookingStore.getState().createBooking({ package_id: 1, slot_id: 5 });
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
      const newBooking = { ...MOCK_BOOKING, id: 101, slot: { ...MOCK_SLOT, id: 10 } };
      mockedApi.post.mockResolvedValueOnce({ data: newBooking });
      const result = await useBookingStore.getState().rescheduleBooking(100, 10);
      expect(result).toEqual(newBooking);
      expect(useBookingStore.getState().bookingResult).toEqual(newBooking);
      expect(useBookingStore.getState().step).toBe(3);
      expect(mockedApi.post).toHaveBeenCalledWith('/bookings/100/reschedule/', { new_slot_id: 10 }, expect.anything());
    });

    it('sets error on failure', async () => {
      mockedApi.post.mockRejectedValueOnce({ response: { data: { detail: 'No se pudo reprogramar la reserva.' } } });
      const result = await useBookingStore.getState().rescheduleBooking(100, 10);
      expect(result).toBeNull();
      expect(useBookingStore.getState().error).toBe('No se pudo reprogramar la reserva.');
    });

    it('uses generic error when no detail in response', async () => {
      mockedApi.post.mockRejectedValueOnce(new Error('Network'));
      const result = await useBookingStore.getState().rescheduleBooking(100, 10);
      expect(result).toBeNull();
      expect(useBookingStore.getState().error).toBe('No se pudo reprogramar la reserva.');
    });

    it('uses generic error when detail is not a string', async () => {
      mockedApi.post.mockRejectedValueOnce({ response: { data: { detail: ['array error'] } } });
      const result = await useBookingStore.getState().rescheduleBooking(100, 10);
      expect(result).toBeNull();
      expect(useBookingStore.getState().error).toBe('No se pudo reprogramar la reserva.');
    });
  });
});
