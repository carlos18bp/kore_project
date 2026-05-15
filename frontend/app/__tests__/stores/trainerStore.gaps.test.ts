import Cookies from 'js-cookie';
import { useTrainerStore } from '@/lib/stores/trainerStore';
import type { PhotoEntry } from '@/lib/stores/trainerStore';
import { api } from '@/lib/services/http';

jest.mock('js-cookie', () => ({ get: jest.fn(), set: jest.fn(), remove: jest.fn() }));
jest.mock('@/lib/services/http', () => ({
  api: { get: jest.fn(), post: jest.fn(), patch: jest.fn(), delete: jest.fn() },
}));

const mockedApi = api as jest.Mocked<typeof api>;

const MOCK_PHOTO: PhotoEntry = {
  meal_entry_id: 10,
  log_id: 5,
  customer_id: 3,
  customer_name: 'Ana García',
  photo_url: 'https://cdn.kore.com/photos/10.jpg',
  meal_block: 'desayuno',
  date: '2026-05-10',
  trainer_comment: '',
  trainer_comment_at: null,
  flagged_for_session: false,
  status: 'pending',
};

function resetStore() {
  useTrainerStore.setState({
    photoGallery: [],
    galleryLoading: false,
    clientAlerts: {},
    clientAlertsLoading: false,
    clientNutritionLogs: {},
    nutritionLogsLoading: false,
    programActionLoading: false,
  });
}

describe('trainerStore — gap actions', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    resetStore();
    (Cookies.get as jest.Mock).mockReturnValue('tok');
  });

  describe('fetchPhotoGallery', () => {
    it('stores photo array on success (all customers)', async () => {
      mockedApi.get.mockResolvedValueOnce({ data: { photos: [MOCK_PHOTO] } });

      await useTrainerStore.getState().fetchPhotoGallery();

      expect(useTrainerStore.getState().photoGallery).toHaveLength(1);
      expect(useTrainerStore.getState().photoGallery[0].meal_entry_id).toBe(10);
      expect(useTrainerStore.getState().galleryLoading).toBe(false);
    });

    it('appends customer_id query param when customerId is provided', async () => {
      mockedApi.get.mockResolvedValueOnce({ data: { photos: [] } });

      await useTrainerStore.getState().fetchPhotoGallery(3);

      expect(mockedApi.get).toHaveBeenCalledWith(
        '/trainer/photo-gallery/?customer_id=3',
        expect.anything(),
      );
    });

    it('calls endpoint without query params when no customerId', async () => {
      mockedApi.get.mockResolvedValueOnce({ data: { photos: [] } });

      await useTrainerStore.getState().fetchPhotoGallery();

      expect(mockedApi.get).toHaveBeenCalledWith(
        '/trainer/photo-gallery/',
        expect.anything(),
      );
    });

    it('stops loading without crashing on failure', async () => {
      mockedApi.get.mockRejectedValueOnce(new Error('Network'));

      await useTrainerStore.getState().fetchPhotoGallery();

      expect(useTrainerStore.getState().galleryLoading).toBe(false);
    });
  });

  describe('commentOnPhoto', () => {
    it('PATCHes comment endpoint and updates the photo in photoGallery', async () => {
      useTrainerStore.setState({ photoGallery: [MOCK_PHOTO] });

      const updatedPhoto = {
        ...MOCK_PHOTO,
        trainer_comment: 'Buen desayuno',
        trainer_comment_at: '2026-05-10T10:00:00Z',
        flagged_for_session: true,
      };
      mockedApi.patch.mockResolvedValueOnce({ data: updatedPhoto });

      await useTrainerStore.getState().commentOnPhoto(10, 'Buen desayuno', true);

      expect(mockedApi.patch).toHaveBeenCalledWith(
        '/trainer/photo-gallery/10/comment/',
        { trainer_comment: 'Buen desayuno', flagged_for_session: true },
        expect.anything(),
      );
      const updated = useTrainerStore.getState().photoGallery.find((p) => p.meal_entry_id === 10);
      expect(updated?.trainer_comment).toBe('Buen desayuno');
      expect(updated?.flagged_for_session).toBe(true);
      expect(updated?.trainer_comment_at).toBe('2026-05-10T10:00:00Z');
    });

    it('leaves photos unchanged when no photo matches the mealId', async () => {
      useTrainerStore.setState({ photoGallery: [MOCK_PHOTO] });
      mockedApi.patch.mockResolvedValueOnce({ data: { trainer_comment: 'X', trainer_comment_at: null, flagged_for_session: false } });

      await useTrainerStore.getState().commentOnPhoto(999, 'X', false);

      expect(useTrainerStore.getState().photoGallery[0].trainer_comment).toBe('');
    });
  });

  describe('fetchClientAlerts', () => {
    it('keys the alerts array by customerId in clientAlerts', async () => {
      const alertsData = [{ id: 1, customer_id: 3, level: 'alto' }];
      mockedApi.get.mockResolvedValueOnce({ data: { alerts: alertsData } });

      await useTrainerStore.getState().fetchClientAlerts(3);

      expect(mockedApi.get).toHaveBeenCalledWith(
        '/trainer/my-clients/3/alerts/',
        expect.anything(),
      );
      expect(useTrainerStore.getState().clientAlerts[3]).toEqual(alertsData);
      expect(useTrainerStore.getState().clientAlertsLoading).toBe(false);
    });

    it('stops loading without crashing on failure', async () => {
      mockedApi.get.mockRejectedValueOnce(new Error('Network'));

      await useTrainerStore.getState().fetchClientAlerts(3);

      expect(useTrainerStore.getState().clientAlertsLoading).toBe(false);
    });
  });

  describe('resumeProgram', () => {
    it('POSTs to resume endpoint and clears programActionLoading', async () => {
      mockedApi.post.mockResolvedValueOnce({});

      await useTrainerStore.getState().resumeProgram(3, 42);

      expect(mockedApi.post).toHaveBeenCalledWith(
        '/trainer/my-clients/3/program/42/resume/',
        {},
        expect.anything(),
      );
      expect(useTrainerStore.getState().programActionLoading).toBe(false);
    });

    it('throws an error when the API call fails', async () => {
      mockedApi.post.mockRejectedValueOnce(new Error('Server error'));

      await expect(useTrainerStore.getState().resumeProgram(3, 42)).rejects.toThrow(
        'No se pudo reanudar el programa.',
      );
      expect(useTrainerStore.getState().programActionLoading).toBe(false);
    });
  });

  describe('fetchClientNutritionLogs', () => {
    it('keys the days array by customerId with default 7 days', async () => {
      const days = [{ date: '2026-05-10', adherence: 0.8, is_closed: true, meals: [] }];
      mockedApi.get.mockResolvedValueOnce({ data: { days } });

      await useTrainerStore.getState().fetchClientNutritionLogs(3);

      expect(mockedApi.get).toHaveBeenCalledWith(
        '/trainer/my-clients/3/nutrition-logs/?days=7',
        expect.anything(),
      );
      expect(useTrainerStore.getState().clientNutritionLogs[3]).toEqual(days);
      expect(useTrainerStore.getState().nutritionLogsLoading).toBe(false);
    });

    it('passes custom days parameter', async () => {
      mockedApi.get.mockResolvedValueOnce({ data: { days: [] } });

      await useTrainerStore.getState().fetchClientNutritionLogs(3, 14);

      expect(mockedApi.get).toHaveBeenCalledWith(
        '/trainer/my-clients/3/nutrition-logs/?days=14',
        expect.anything(),
      );
    });

    it('stops loading without crashing on failure', async () => {
      mockedApi.get.mockRejectedValueOnce(new Error('Network'));

      await useTrainerStore.getState().fetchClientNutritionLogs(3);

      expect(useTrainerStore.getState().nutritionLogsLoading).toBe(false);
    });
  });
});
