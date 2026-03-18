import Cookies from 'js-cookie';
import { useNutritionStore } from '@/lib/stores/nutritionStore';
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
  useNutritionStore.setState({
    entries: [],
    loading: false,
    submitting: false,
    error: '',
  });
}

const MOCK_ENTRY = {
  id: 1,
  customer_id: 10,
  meals_per_day: 3,
  water_liters: '2.0',
  fruit_weekly: 5,
  vegetable_weekly: 7,
  protein_frequency: 4,
  ultraprocessed_weekly: 2,
  sugary_drinks_weekly: 1,
  eats_breakfast: true,
  notes: 'Good habits',
  habit_score: '85.0',
  habit_category: 'Bueno',
  habit_color: 'green',
  created_at: '2025-01-15T12:00:00Z',
};

const MOCK_FORM_DATA = {
  meals_per_day: 3,
  water_liters: 2.0,
  fruit_weekly: 5,
  vegetable_weekly: 7,
  protein_frequency: 4,
  ultraprocessed_weekly: 2,
  sugary_drinks_weekly: 1,
  eats_breakfast: true,
  notes: 'Good habits',
};

describe('nutritionStore', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    resetStore();
    (Cookies.get as jest.Mock).mockReturnValue('fake-token');
  });

  describe('fetchMyEntries', () => {
    it('sets loading true then populates entries on success', async () => {
      mockedApi.get.mockResolvedValueOnce({ data: [MOCK_ENTRY] });
      await useNutritionStore.getState().fetchMyEntries();
      const state = useNutritionStore.getState();
      expect(state.entries).toHaveLength(1);
      expect(state.entries[0].id).toBe(1);
      expect(state.loading).toBe(false);
      expect(mockedApi.get).toHaveBeenCalledWith('/my-nutrition/', {
        headers: { Authorization: 'Bearer fake-token' },
      });
    });

    it('sets error on failure', async () => {
      mockedApi.get.mockRejectedValueOnce(new Error('Network'));
      await useNutritionStore.getState().fetchMyEntries();
      const state = useNutritionStore.getState();
      expect(state.error).toBe('No se pudieron cargar tus registros de nutrición.');
      expect(state.loading).toBe(false);
    });

    it('sends empty auth headers when no token', async () => {
      (Cookies.get as jest.Mock).mockReturnValue(undefined);
      mockedApi.get.mockResolvedValueOnce({ data: [] });
      await useNutritionStore.getState().fetchMyEntries();
      expect(mockedApi.get).toHaveBeenCalledWith('/my-nutrition/', { headers: {} });
    });
  });

  describe('createEntry', () => {
    it('prepends new entry to list on success', async () => {
      useNutritionStore.setState({ entries: [MOCK_ENTRY] });
      const newEntry = { ...MOCK_ENTRY, id: 2 };
      mockedApi.post.mockResolvedValueOnce({ data: newEntry });
      const result = await useNutritionStore.getState().createEntry(MOCK_FORM_DATA);
      const state = useNutritionStore.getState();
      expect(result).toEqual(newEntry);
      expect(state.entries).toHaveLength(2);
      expect(state.entries[0].id).toBe(2);
      expect(state.submitting).toBe(false);
    });

    it('returns null and sets error on failure', async () => {
      mockedApi.post.mockRejectedValueOnce(new Error('Network'));
      const result = await useNutritionStore.getState().createEntry(MOCK_FORM_DATA);
      expect(result).toBeNull();
      expect(useNutritionStore.getState().error).toBe('No se pudo guardar el registro de nutrición.');
      expect(useNutritionStore.getState().submitting).toBe(false);
    });

    it('extracts detail from error response', async () => {
      mockedApi.post.mockRejectedValueOnce({ response: { data: { detail: 'Duplicate entry.' } } });
      const result = await useNutritionStore.getState().createEntry(MOCK_FORM_DATA);
      expect(result).toBeNull();
      expect(useNutritionStore.getState().error).toBe('Duplicate entry.');
    });
  });

  describe('fetchClientEntries', () => {
    it('populates entries for a given client', async () => {
      mockedApi.get.mockResolvedValueOnce({ data: [MOCK_ENTRY] });
      await useNutritionStore.getState().fetchClientEntries(10);
      const state = useNutritionStore.getState();
      expect(state.entries).toHaveLength(1);
      expect(state.loading).toBe(false);
      expect(mockedApi.get).toHaveBeenCalledWith('/trainer/my-clients/10/nutrition/', {
        headers: { Authorization: 'Bearer fake-token' },
      });
    });

    it('sets error on failure', async () => {
      mockedApi.get.mockRejectedValueOnce(new Error('Network'));
      await useNutritionStore.getState().fetchClientEntries(10);
      expect(useNutritionStore.getState().error).toBe('No se pudieron cargar los registros de nutrición.');
      expect(useNutritionStore.getState().loading).toBe(false);
    });
  });
});
