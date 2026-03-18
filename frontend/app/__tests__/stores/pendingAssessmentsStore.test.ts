import Cookies from 'js-cookie';
import { usePendingAssessmentsStore } from '@/lib/stores/pendingAssessmentsStore';
import { api } from '@/lib/services/http';

jest.mock('js-cookie', () => ({
  get: jest.fn(),
  set: jest.fn(),
  remove: jest.fn(),
}));

jest.mock('@/lib/services/http', () => ({
  api: {
    get: jest.fn(),
  },
}));

const mockedApi = api as jest.Mocked<typeof api>;

function resetStore() {
  usePendingAssessmentsStore.setState({
    nutritionDue: false,
    parqDue: false,
    anthropometryUnseen: false,
    posturometryUnseen: false,
    physicalEvalUnseen: false,
    profileIncomplete: false,
    subscriptionExpiring: false,
    koreIndex: null,
    loaded: false,
  });
}

const MOCK_PENDING_RESPONSE = {
  nutrition_due: true,
  parq_due: false,
  latest_anthropometry_at: '2025-02-15T12:00:00Z',
  latest_posturometry_at: null,
  latest_physical_eval_at: '2025-01-10T08:00:00Z',
  profile_incomplete: true,
  subscription_expiring: false,
  kore_index: {
    kore_score: 75,
    kore_category: 'Bueno',
    kore_color: 'green',
    kore_message: 'Great progress',
    components: { strength: 80, endurance: 70 },
    modules_available: 3,
    modules_total: 5,
  },
};

describe('pendingAssessmentsStore', () => {
  const localStorageMock: Record<string, string> = {};

  beforeEach(() => {
    jest.resetAllMocks();
    resetStore();
    (Cookies.get as jest.Mock).mockReturnValue('fake-token');

    jest.spyOn(Storage.prototype, 'getItem').mockImplementation((key: string) => {
      return localStorageMock[key] ?? null;
    });
    jest.spyOn(Storage.prototype, 'setItem').mockImplementation((key: string, value: string) => {
      localStorageMock[key] = value;
    });

    Object.keys(localStorageMock).forEach((key) => delete localStorageMock[key]);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('fetchPending', () => {
    it('populates all flags from API response on success', async () => {
      mockedApi.get.mockResolvedValueOnce({ data: MOCK_PENDING_RESPONSE });
      await usePendingAssessmentsStore.getState().fetchPending();
      const state = usePendingAssessmentsStore.getState();
      expect(state.nutritionDue).toBe(true);
      expect(state.parqDue).toBe(false);
      expect(state.profileIncomplete).toBe(true);
      expect(state.subscriptionExpiring).toBe(false);
      expect(state.koreIndex).toEqual(MOCK_PENDING_RESPONSE.kore_index);
      expect(state.loaded).toBe(true);
    });

    it('marks anthropometry as unseen when no localStorage entry exists', async () => {
      mockedApi.get.mockResolvedValueOnce({ data: MOCK_PENDING_RESPONSE });
      await usePendingAssessmentsStore.getState().fetchPending();
      expect(usePendingAssessmentsStore.getState().anthropometryUnseen).toBe(true);
    });

    it('marks anthropometry as seen when localStorage has a newer timestamp', async () => {
      localStorageMock['kore_seen_anthropometry'] = '2025-03-01T00:00:00Z';
      mockedApi.get.mockResolvedValueOnce({ data: MOCK_PENDING_RESPONSE });
      await usePendingAssessmentsStore.getState().fetchPending();
      expect(usePendingAssessmentsStore.getState().anthropometryUnseen).toBe(false);
    });

    it('marks anthropometry as unseen when localStorage has an older timestamp', async () => {
      localStorageMock['kore_seen_anthropometry'] = '2025-01-01T00:00:00Z';
      mockedApi.get.mockResolvedValueOnce({ data: MOCK_PENDING_RESPONSE });
      await usePendingAssessmentsStore.getState().fetchPending();
      expect(usePendingAssessmentsStore.getState().anthropometryUnseen).toBe(true);
    });

    it('marks posturometry as not unseen when latest is null', async () => {
      mockedApi.get.mockResolvedValueOnce({ data: MOCK_PENDING_RESPONSE });
      await usePendingAssessmentsStore.getState().fetchPending();
      expect(usePendingAssessmentsStore.getState().posturometryUnseen).toBe(false);
    });

    it('marks physicalEval as unseen when no localStorage entry exists', async () => {
      mockedApi.get.mockResolvedValueOnce({ data: MOCK_PENDING_RESPONSE });
      await usePendingAssessmentsStore.getState().fetchPending();
      expect(usePendingAssessmentsStore.getState().physicalEvalUnseen).toBe(true);
    });

    it('sets koreIndex to null when not present in response', async () => {
      mockedApi.get.mockResolvedValueOnce({
        data: { ...MOCK_PENDING_RESPONSE, kore_index: null },
      });
      await usePendingAssessmentsStore.getState().fetchPending();
      expect(usePendingAssessmentsStore.getState().koreIndex).toBeNull();
    });

    it('sets loaded to true on failure', async () => {
      mockedApi.get.mockRejectedValueOnce(new Error('Network'));
      await usePendingAssessmentsStore.getState().fetchPending();
      expect(usePendingAssessmentsStore.getState().loaded).toBe(true);
    });

    it('does not change flags on failure', async () => {
      mockedApi.get.mockRejectedValueOnce(new Error('Network'));
      await usePendingAssessmentsStore.getState().fetchPending();
      const state = usePendingAssessmentsStore.getState();
      expect(state.nutritionDue).toBe(false);
      expect(state.parqDue).toBe(false);
    });
  });

  describe('markSeen', () => {
    it('marks anthropometry as seen and sets localStorage', () => {
      usePendingAssessmentsStore.setState({ anthropometryUnseen: true });
      usePendingAssessmentsStore.getState().markSeen('anthropometry');
      expect(usePendingAssessmentsStore.getState().anthropometryUnseen).toBe(false);
      expect(localStorageMock['kore_seen_anthropometry']).toBeDefined();
    });

    it('marks posturometry as seen and sets localStorage', () => {
      usePendingAssessmentsStore.setState({ posturometryUnseen: true });
      usePendingAssessmentsStore.getState().markSeen('posturometry');
      expect(usePendingAssessmentsStore.getState().posturometryUnseen).toBe(false);
      expect(localStorageMock['kore_seen_posturometry']).toBeDefined();
    });

    it('marks physical_eval as seen and sets localStorage', () => {
      usePendingAssessmentsStore.setState({ physicalEvalUnseen: true });
      usePendingAssessmentsStore.getState().markSeen('physical_eval');
      expect(usePendingAssessmentsStore.getState().physicalEvalUnseen).toBe(false);
      expect(localStorageMock['kore_seen_physical_eval']).toBeDefined();
    });

    it('does not change state for unknown key', () => {
      usePendingAssessmentsStore.setState({ anthropometryUnseen: true });
      usePendingAssessmentsStore.getState().markSeen('unknown_key');
      expect(usePendingAssessmentsStore.getState().anthropometryUnseen).toBe(true);
      expect(localStorageMock['kore_seen_unknown_key']).toBeDefined();
    });
  });
});
