import Cookies from 'js-cookie';
import { useProgramStore } from '@/lib/stores/programStore';
import { api } from '@/lib/services/http';

jest.mock('js-cookie', () => ({
  get: jest.fn(),
  set: jest.fn(),
  remove: jest.fn(),
}));

jest.mock('@/lib/services/http', () => ({
  api: { get: jest.fn(), patch: jest.fn(), post: jest.fn() },
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
    it('leaves todayData null without flagging an error when backend returns 200 null', async () => {
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

describe('programStore — exercise log actions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetStore();
  });

  describe('updateExerciseStatus', () => {
    function seedTodayData() {
      useProgramStore.setState({
        todayData: {
          program_day: { id: 1, day_number: 1, date: '2026-07-20', day_type: 'training', exercises: [] },
          daily_log: {
            id: 5,
            date: '2026-07-20',
            is_closed: false,
            closed_at: null,
            exercise_logs: [
              { id: 31, status: 'not_done', notes: '' },
              { id: 32, status: 'not_done', notes: '' },
            ],
          },
        } as never,
      });
    }

    it('applies the returned status to the matching exercise log', async () => {
      seedTodayData();
      mockedApi.patch.mockResolvedValueOnce({ data: { id: 31, status: 'completed' } });

      await useProgramStore.getState().updateExerciseStatus(5, 31, 'completed');

      expect(mockedApi.patch).toHaveBeenCalledWith(
        '/my-program/logs/5/exercises/31/',
        { status: 'completed' },
        expect.anything(),
      );
      const logs = useProgramStore.getState().todayData!.daily_log.exercise_logs;
      expect(logs.find((l) => l.id === 31)!.status).toBe('completed');
      expect(logs.find((l) => l.id === 32)!.status).toBe('not_done');
    });

    it('records an error message when the PATCH fails', async () => {
      seedTodayData();
      mockedApi.patch.mockRejectedValueOnce(new Error('Network Error'));

      await useProgramStore.getState().updateExerciseStatus(5, 31, 'completed');

      expect(useProgramStore.getState().error).toBe('No se pudo actualizar el ejercicio.');
      expect(useProgramStore.getState().todayData!.daily_log.exercise_logs[0].status).toBe('not_done');
    });
  });

  describe('uploadExerciseCapture', () => {
    it('returns true after posting the image as form data', async () => {
      mockedApi.post.mockResolvedValueOnce({ data: {} });
      const file = new File(['img'], 'capture.png', { type: 'image/png' });

      const ok = await useProgramStore.getState().uploadExerciseCapture(5, 31, file);

      expect(ok).toBe(true);
      expect(mockedApi.post).toHaveBeenCalledWith(
        '/my-program/logs/5/exercises/31/captures/',
        expect.any(FormData),
        expect.anything(),
      );
      const sentForm = mockedApi.post.mock.calls[0][1] as FormData;
      expect(sentForm.get('image')).toBe(file);
    });

    it('returns false when the capture upload fails', async () => {
      mockedApi.post.mockRejectedValueOnce(new Error('Network Error'));
      const file = new File(['img'], 'capture.png', { type: 'image/png' });

      const ok = await useProgramStore.getState().uploadExerciseCapture(5, 31, file);

      expect(ok).toBe(false);
    });
  });
});
