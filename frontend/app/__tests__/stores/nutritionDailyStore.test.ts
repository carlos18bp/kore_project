import Cookies from 'js-cookie';
import { useNutritionDailyStore } from '@/lib/stores/nutritionDailyStore';
import { api } from '@/lib/services/http';
import type { NutritionDailyLog, MealEntry } from '@/lib/stores/nutritionDailyStore';

jest.mock('js-cookie', () => ({
  get: jest.fn(),
  set: jest.fn(),
  remove: jest.fn(),
}));

jest.mock('@/lib/services/http', () => ({
  api: {
    get: jest.fn(),
    patch: jest.fn(),
    post: jest.fn(),
  },
}));

const mockedCookies = Cookies as jest.Mocked<typeof Cookies>;
const mockedApi = api as jest.Mocked<typeof api>;

function makeMealEntry(id: number, overrides: Partial<MealEntry> = {}): MealEntry {
  return {
    id,
    meal_block: 'breakfast',
    suggestion: null,
    status: 'not_done',
    notes: '',
    photo_url: null,
    ...overrides,
  };
}

function makeTodayLog(overrides: Partial<NutritionDailyLog> = {}): NutritionDailyLog {
  return {
    id: 10,
    date: '2026-05-15',
    is_closed: false,
    closed_at: null,
    notes: '',
    meal_entries: [makeMealEntry(1), makeMealEntry(2)],
    program_goal: null,
    trainer_nutrition_note: null,
    ...overrides,
  };
}

function resetStore() {
  useNutritionDailyStore.setState({
    todayLog: null,
    loading: false,
    error: '',
  });
}

describe('nutritionDailyStore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetStore();
    (mockedCookies.get as jest.Mock).mockReturnValue('fake-token');
  });

  // ----------------------------------------------------------------
  // fetchTodayLog
  // ----------------------------------------------------------------
  describe('fetchTodayLog', () => {
    it('sets todayLog and clears loading on success', async () => {
      const log = makeTodayLog();
      mockedApi.get.mockResolvedValueOnce({ data: log });

      await useNutritionDailyStore.getState().fetchTodayLog();

      const state = useNutritionDailyStore.getState();
      expect(state.todayLog).toEqual(log);
      expect(state.loading).toBe(false);
      expect(state.error).toBe('');
    });

    it('sets error and todayLog to null on network failure', async () => {
      mockedApi.get.mockRejectedValueOnce(new Error('Network Error'));

      await useNutritionDailyStore.getState().fetchTodayLog();

      const state = useNutritionDailyStore.getState();
      expect(state.todayLog).toBeNull();
      expect(state.loading).toBe(false);
      expect(state.error).toBe('No se pudo cargar la nutrición de hoy.');
    });

    it('sends Authorization header when token cookie exists', async () => {
      mockedApi.get.mockResolvedValueOnce({ data: makeTodayLog() });

      await useNutritionDailyStore.getState().fetchTodayLog();

      expect(mockedApi.get).toHaveBeenCalledWith(
        '/my-nutrition-daily/today/',
        expect.objectContaining({ headers: { Authorization: 'Bearer fake-token' } }),
      );
    });

    it('sends empty headers when no token cookie exists', async () => {
      (mockedCookies.get as jest.Mock).mockReturnValue(undefined);
      mockedApi.get.mockResolvedValueOnce({ data: makeTodayLog() });

      await useNutritionDailyStore.getState().fetchTodayLog();

      expect(mockedApi.get).toHaveBeenCalledWith(
        '/my-nutrition-daily/today/',
        expect.objectContaining({ headers: {} }),
      );
    });
  });

  // ----------------------------------------------------------------
  // updateMealEntry
  // ----------------------------------------------------------------
  describe('updateMealEntry', () => {
    it('patches endpoint and replaces matching meal entry with updated status and notes', async () => {
      const log = makeTodayLog();
      useNutritionDailyStore.setState({ todayLog: log });

      const updatedEntry: MealEntry = { ...makeMealEntry(1), status: 'completed', notes: 'Bien' };
      mockedApi.patch.mockResolvedValueOnce({ data: updatedEntry });

      await useNutritionDailyStore.getState().updateMealEntry(10, 1, 'completed', 'Bien');

      const entries = useNutritionDailyStore.getState().todayLog!.meal_entries;
      expect(entries.find((e) => e.id === 1)?.status).toBe('completed');
      expect(entries.find((e) => e.id === 1)?.notes).toBe('Bien');
      expect(mockedApi.patch).toHaveBeenCalledWith(
        '/my-nutrition-daily/10/meals/1/',
        { status: 'completed', notes: 'Bien' },
        expect.any(Object),
      );
    });

    it('omits notes from payload when called without the notes argument', async () => {
      const log = makeTodayLog();
      useNutritionDailyStore.setState({ todayLog: log });

      const updatedEntry: MealEntry = { ...makeMealEntry(1), status: 'skipped', notes: '' };
      mockedApi.patch.mockResolvedValueOnce({ data: updatedEntry });

      await useNutritionDailyStore.getState().updateMealEntry(10, 1, 'skipped');

      expect(mockedApi.patch).toHaveBeenCalledWith(
        '/my-nutrition-daily/10/meals/1/',
        { status: 'skipped' },
        expect.any(Object),
      );
    });

    it('leaves state unchanged when updateMealEntry is called with todayLog null', async () => {
      useNutritionDailyStore.setState({ todayLog: null });
      const updatedEntry: MealEntry = { ...makeMealEntry(1), status: 'completed', notes: '' };
      mockedApi.patch.mockResolvedValueOnce({ data: updatedEntry });

      await useNutritionDailyStore.getState().updateMealEntry(10, 1, 'completed');

      expect(useNutritionDailyStore.getState().todayLog).toBeNull();
    });

    it('sets error when updateMealEntry fails', async () => {
      useNutritionDailyStore.setState({ todayLog: makeTodayLog() });
      mockedApi.patch.mockRejectedValueOnce(new Error('fail'));

      await useNutritionDailyStore.getState().updateMealEntry(10, 1, 'completed');

      expect(useNutritionDailyStore.getState().error).toBe('No se pudo actualizar la comida.');
    });
  });

  // ----------------------------------------------------------------
  // uploadMealPhoto
  // ----------------------------------------------------------------
  describe('uploadMealPhoto', () => {
    it('posts FormData to photo endpoint and updates photo_url of matching meal entry', async () => {
      const log = makeTodayLog();
      useNutritionDailyStore.setState({ todayLog: log });

      const updatedEntry: MealEntry = { ...makeMealEntry(1), photo_url: 'https://cdn.kore/photo.jpg' };
      mockedApi.post.mockResolvedValueOnce({ data: updatedEntry });

      const file = new File(['img'], 'meal.jpg', { type: 'image/jpeg' });
      await useNutritionDailyStore.getState().uploadMealPhoto(10, 1, file);

      const entries = useNutritionDailyStore.getState().todayLog!.meal_entries;
      expect(entries.find((e) => e.id === 1)?.photo_url).toBe('https://cdn.kore/photo.jpg');
    });

    it('leaves state unchanged when uploadMealPhoto is called with todayLog null', async () => {
      useNutritionDailyStore.setState({ todayLog: null });
      const updatedEntry: MealEntry = { ...makeMealEntry(1), photo_url: 'https://cdn.kore/photo.jpg' };
      mockedApi.post.mockResolvedValueOnce({ data: updatedEntry });

      const file = new File(['img'], 'meal.jpg', { type: 'image/jpeg' });
      await useNutritionDailyStore.getState().uploadMealPhoto(10, 1, file);

      expect(useNutritionDailyStore.getState().todayLog).toBeNull();
    });

    it('sets error when uploadMealPhoto fails', async () => {
      useNutritionDailyStore.setState({ todayLog: makeTodayLog() });
      mockedApi.post.mockRejectedValueOnce(new Error('fail'));

      const file = new File(['img'], 'meal.jpg', { type: 'image/jpeg' });
      await useNutritionDailyStore.getState().uploadMealPhoto(10, 1, file);

      expect(useNutritionDailyStore.getState().error).toBe('No se pudo subir la foto.');
    });

    it('sends multipart/form-data content-type header', async () => {
      useNutritionDailyStore.setState({ todayLog: makeTodayLog() });
      const updatedEntry: MealEntry = { ...makeMealEntry(1), photo_url: 'url' };
      mockedApi.post.mockResolvedValueOnce({ data: updatedEntry });

      const file = new File(['img'], 'meal.jpg', { type: 'image/jpeg' });
      await useNutritionDailyStore.getState().uploadMealPhoto(10, 1, file);

      expect(mockedApi.post).toHaveBeenCalledWith(
        '/my-nutrition-daily/10/meals/1/photo/',
        expect.any(FormData),
        expect.objectContaining({
          headers: expect.objectContaining({ 'Content-Type': 'multipart/form-data' }),
        }),
      );
    });
  });
});
