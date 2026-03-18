import Cookies from 'js-cookie';
import { useProfileStore } from '@/lib/stores/profileStore';
import { api } from '@/lib/services/http';

jest.mock('js-cookie', () => ({
  get: jest.fn(),
  set: jest.fn(),
  remove: jest.fn(),
}));

jest.mock('@/lib/services/http', () => ({
  api: { get: jest.fn(), post: jest.fn(), patch: jest.fn() },
}));

const mockedCookies = Cookies as jest.Mocked<typeof Cookies>;
const mockedApi = api as jest.Mocked<typeof api>;

const MOCK_PROFILE_RESPONSE = {
  user: {
    id: 1,
    email: 'test@kore.com',
    first_name: 'Test',
    last_name: 'User',
    phone: '123',
    role: 'customer',
    customer_profile: {
      avatar_url: null,
      sex: '',
      height_cm: null,
      current_weight_kg: null,
      city: '',
      primary_goal: '',
      kore_start_date: '2025-01-01',
      profile_completed: false,
    },
    today_mood: null,
  },
};

function resetStore() {
  useProfileStore.setState({
    profile: null,
    todayMood: null,
    loading: false,
    saving: false,
    error: '',
    successMessage: '',
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  resetStore();
  (mockedCookies.get as jest.Mock).mockReturnValue('fake-token');
});

describe('profileStore', () => {
  describe('fetchProfile', () => {
    it('fetches profile and sets state', async () => {
      mockedApi.get.mockResolvedValueOnce({ data: MOCK_PROFILE_RESPONSE });

      await useProfileStore.getState().fetchProfile();

      const state = useProfileStore.getState();
      expect(state.profile).toEqual(MOCK_PROFILE_RESPONSE.user);
      expect(state.todayMood).toBeNull();
      expect(state.loading).toBe(false);
      expect(mockedApi.get).toHaveBeenCalledWith('/auth/profile/', expect.any(Object));
    });

    it('sets error on failure', async () => {
      mockedApi.get.mockRejectedValueOnce(new Error('Network error'));

      await useProfileStore.getState().fetchProfile();

      const state = useProfileStore.getState();
      expect(state.error).toBe('No se pudo cargar el perfil.');
      expect(state.loading).toBe(false);
    });
  });

  describe('updateProfile', () => {
    it('sends PATCH and updates state on success', async () => {
      const updatedResp = {
        data: {
          user: {
            ...MOCK_PROFILE_RESPONSE.user,
            first_name: 'Nuevo',
            customer_profile: {
              ...MOCK_PROFILE_RESPONSE.user.customer_profile,
              sex: 'masculino',
              profile_completed: true,
            },
          },
        },
      };
      mockedApi.patch.mockResolvedValueOnce(updatedResp);

      const result = await useProfileStore.getState().updateProfile({ first_name: 'Nuevo', sex: 'masculino' });

      expect(result.success).toBe(true);
      expect(useProfileStore.getState().profile?.first_name).toBe('Nuevo');
      expect(useProfileStore.getState().successMessage).toBeTruthy();
    });

    it('returns error on failure', async () => {
      mockedApi.patch.mockRejectedValueOnce(new Error('fail'));

      const result = await useProfileStore.getState().updateProfile({ city: 'Bogotá' });

      expect(result.success).toBe(false);
      expect(useProfileStore.getState().error).toBeTruthy();
    });
  });

  describe('uploadAvatar', () => {
    it('uploads file and refreshes profile', async () => {
      mockedApi.post.mockResolvedValueOnce({ data: { avatar_url: 'http://example.com/avatar.jpg' } });
      mockedApi.get.mockResolvedValueOnce({ data: MOCK_PROFILE_RESPONSE });

      const file = new File(['test'], 'avatar.png', { type: 'image/png' });
      const result = await useProfileStore.getState().uploadAvatar(file);

      expect(result.success).toBe(true);
      expect(result.avatar_url).toBe('http://example.com/avatar.jpg');
      expect(mockedApi.post).toHaveBeenCalledWith(
        '/auth/profile/avatar/',
        expect.any(FormData),
        expect.any(Object),
      );
    });
  });

  describe('changePassword', () => {
    it('sends POST and returns success', async () => {
      mockedApi.post.mockResolvedValueOnce({ data: { detail: 'ok' } });

      const result = await useProfileStore.getState().changePassword({
        current_password: 'old',
        new_password: 'newPass123!',
        new_password_confirm: 'newPass123!',
      });

      expect(result.success).toBe(true);
      expect(useProfileStore.getState().successMessage).toBeTruthy();
    });

    it('returns error on wrong current password', async () => {
      mockedApi.post.mockRejectedValueOnce({
        response: { data: { current_password: ['La contraseña actual es incorrecta.'] } },
      });

      const result = await useProfileStore.getState().changePassword({
        current_password: 'wrong',
        new_password: 'new',
        new_password_confirm: 'new',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('incorrecta');
    });
  });

  describe('submitMood', () => {
    it('posts mood and updates todayMood', async () => {
      mockedApi.post.mockResolvedValueOnce({
        data: { score: 5, notes: '', date: '2025-03-07' },
      });

      const result = await useProfileStore.getState().submitMood(5);

      expect(result.success).toBe(true);
      expect(useProfileStore.getState().todayMood?.score).toBe(5);
    });
  });

  describe('submitWeight', () => {
    it('posts weight and re-fetches profile', async () => {
      mockedApi.post.mockResolvedValueOnce({ data: { weight_kg: '72.5', date: '2025-03-07' } });
      mockedApi.get.mockResolvedValueOnce({ data: MOCK_PROFILE_RESPONSE });

      const result = await useProfileStore.getState().submitWeight(72.5);

      expect(result.success).toBe(true);
      expect(mockedApi.post).toHaveBeenCalledWith(
        '/auth/weight/',
        { weight_kg: 72.5 },
        expect.any(Object),
      );
    });

    it('returns error on failure', async () => {
      mockedApi.post.mockRejectedValueOnce(new Error('fail'));
      const result = await useProfileStore.getState().submitWeight(80);
      expect(result.success).toBe(false);
      expect(result.error).toContain('peso');
      expect(useProfileStore.getState().saving).toBe(false);
    });
  });

  describe('uploadAvatar', () => {
    it('returns error on failure', async () => {
      mockedApi.post.mockRejectedValueOnce(new Error('fail'));
      const file = new File(['test'], 'avatar.png', { type: 'image/png' });
      const result = await useProfileStore.getState().uploadAvatar(file);
      expect(result.success).toBe(false);
      expect(result.error).toContain('imagen');
      expect(useProfileStore.getState().saving).toBe(false);
    });
  });

  describe('submitMood', () => {
    it('includes notes when provided', async () => {
      mockedApi.post.mockResolvedValueOnce({
        data: { score: 4, notes: 'Feeling great', date: '2025-03-07' },
      });
      useProfileStore.setState({ profile: MOCK_PROFILE_RESPONSE.user as never });

      const result = await useProfileStore.getState().submitMood(4, 'Feeling great');

      expect(result.success).toBe(true);
      expect(mockedApi.post).toHaveBeenCalledWith(
        '/auth/mood/',
        { score: 4, notes: 'Feeling great' },
        expect.any(Object),
      );
      expect(useProfileStore.getState().todayMood?.notes).toBe('Feeling great');
    });

    it('returns error on failure', async () => {
      mockedApi.post.mockRejectedValueOnce(new Error('fail'));
      const result = await useProfileStore.getState().submitMood(3);
      expect(result.success).toBe(false);
      expect(result.error).toContain('anímico');
    });
  });

  describe('changePassword', () => {
    it('extracts string error value from response', async () => {
      mockedApi.post.mockRejectedValueOnce({
        response: { data: { detail: 'Token expired' } },
      });
      const result = await useProfileStore.getState().changePassword({
        current_password: 'old',
        new_password: 'new',
        new_password_confirm: 'new',
      });
      expect(result.success).toBe(false);
      expect(result.error).toBe('Token expired');
    });

    it('uses fallback error when response data is empty', async () => {
      mockedApi.post.mockRejectedValueOnce(new Error('Network'));
      const result = await useProfileStore.getState().changePassword({
        current_password: 'old',
        new_password: 'new',
        new_password_confirm: 'new',
      });
      expect(result.success).toBe(false);
      expect(result.error).toBe('Error al cambiar la contraseña.');
    });
  });

  describe('clearMessages', () => {
    it('clears error and success message', () => {
      useProfileStore.setState({ error: 'Some error', successMessage: 'Some success' });
      useProfileStore.getState().clearMessages();
      const state = useProfileStore.getState();
      expect(state.error).toBe('');
      expect(state.successMessage).toBe('');
    });
  });

  describe('syncAuthStoreUser', () => {
    it('skips auth store update when data is unchanged', async () => {
      mockedApi.get.mockResolvedValueOnce({ data: MOCK_PROFILE_RESPONSE });
      await useProfileStore.getState().fetchProfile();

      const setCookieCalls = (Cookies.set as jest.Mock).mock.calls.length;

      mockedApi.get.mockResolvedValueOnce({ data: MOCK_PROFILE_RESPONSE });
      await useProfileStore.getState().fetchProfile();

      expect((Cookies.set as jest.Mock).mock.calls.length).toBe(setCookieCalls);
    });
  });
});
