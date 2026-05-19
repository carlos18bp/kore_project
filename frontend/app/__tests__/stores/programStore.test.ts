import Cookies from 'js-cookie';
import { useProgramStore } from '@/lib/stores/programStore';
import { api } from '@/lib/services/http';

jest.mock('js-cookie', () => ({
  get: jest.fn(),
  set: jest.fn(),
  remove: jest.fn(),
}));

jest.mock('@/lib/services/http', () => ({
  api: { get: jest.fn(), patch: jest.fn() },
}));

const mockedApi = api as jest.Mocked<typeof api>;

function resetStore() {
  useProgramStore.setState({
    activeProgram: null,
    todayData: null,
    loading: false,
    todayLoading: false,
    error: '',
  });
}

const FAKE_PROGRAM = {
  id: 1,
  customer_id: 22,
  fitness_level: 1,
  goal: 'general_health',
  start_date: '2026-05-01',
  end_date: '2026-05-28',
  status: 'published',
  trainer_notes: '',
  approved_at: null,
  created_at: '2026-05-01T00:00:00Z',
  days: [],
  booking_dates: [],
};

describe('programStore — empty-state contract (200 + null)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetStore();
  });

  describe('fetchActiveProgram', () => {
    it('stores null without flagging an error when backend returns 200 null', async () => {
      mockedApi.get.mockResolvedValueOnce({ data: null });

      await useProgramStore.getState().fetchActiveProgram();

      const state = useProgramStore.getState();
      expect(state.activeProgram).toBeNull();
      expect(state.loading).toBe(false);
      expect(state.error).toBe('');
    });

    it('stores the program payload when backend returns a program', async () => {
      mockedApi.get.mockResolvedValueOnce({ data: FAKE_PROGRAM });

      await useProgramStore.getState().fetchActiveProgram();

      const state = useProgramStore.getState();
      expect(state.activeProgram).not.toBeNull();
      expect(state.activeProgram!.id).toBe(1);
      expect(state.error).toBe('');
    });

    it('records an error message when the request fails (5xx / network)', async () => {
      mockedApi.get.mockRejectedValueOnce(new Error('Network Error'));

      await useProgramStore.getState().fetchActiveProgram();

      const state = useProgramStore.getState();
      expect(state.activeProgram).toBeNull();
      expect(state.loading).toBe(false);
      expect(state.error).toBe('No se pudo cargar el programa.');
    });
  });

  describe('fetchTodayData', () => {
    it('stores null without flagging an error when backend returns 200 null', async () => {
      mockedApi.get.mockResolvedValueOnce({ data: null });

      await useProgramStore.getState().fetchTodayData();

      const state = useProgramStore.getState();
      expect(state.todayData).toBeNull();
      expect(state.todayLoading).toBe(false);
      expect(state.error).toBe('');
    });

    it('stores the day payload when backend returns one', async () => {
      const today = { program_day: { id: 1 }, daily_log: { id: 5 } };
      mockedApi.get.mockResolvedValueOnce({ data: today });

      await useProgramStore.getState().fetchTodayData();

      const state = useProgramStore.getState();
      expect(state.todayData).toEqual(today);
    });
  });
});
