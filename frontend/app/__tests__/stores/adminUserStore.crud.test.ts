import Cookies from 'js-cookie';
import { useAdminUserStore } from '@/lib/stores/adminUserStore';
import type { AdminUser, AdminUserDetail } from '@/lib/stores/adminUserStore';
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
    patch: jest.fn(),
    delete: jest.fn(),
  },
}));

const mockedApi = api as jest.Mocked<typeof api>;

const MOCK_USER: AdminUser = {
  id: 7,
  email: 'carlos@kore.com',
  first_name: 'Carlos',
  last_name: 'Pérez',
  full_name: 'Carlos Pérez',
  phone: '3001234567',
  role: 'customer',
  is_active: true,
  must_change_password: false,
  date_joined: '2026-01-01T00:00:00Z',
  last_login: null,
  has_active_subscription: true,
  sessions_used_total: 4,
  sessions_total_total: 8,
};

const MOCK_USER_DETAIL: AdminUserDetail = {
  ...MOCK_USER,
  subscriptions: [],
  assigned_trainer: null,
  assigned_clients: null,
};

function resetStore() {
  useAdminUserStore.setState({
    users: [],
    totalCount: 0,
    selected: null,
    filters: { search: '', role: 'all', page: 1 },
    loading: false,
    actionLoading: false,
    error: '',
    assignmentSummary: null,
  });
}

describe('adminUserStore — CRUD actions', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    resetStore();
    (Cookies.get as jest.Mock).mockReturnValue('fake-token');
  });

  describe('fetchUsers', () => {
    it('stores users and totalCount from paginated response', async () => {
      (mockedApi.get as jest.Mock).mockResolvedValueOnce({
        data: { results: [MOCK_USER], count: 1 },
      });

      await useAdminUserStore.getState().fetchUsers();

      const state = useAdminUserStore.getState();
      expect(state.users).toHaveLength(1);
      expect(state.users[0].email).toBe('carlos@kore.com');
      expect(state.totalCount).toBe(1);
      expect(state.loading).toBe(false);
    });

    it('handles flat array response', async () => {
      (mockedApi.get as jest.Mock).mockResolvedValueOnce({ data: [MOCK_USER] });

      await useAdminUserStore.getState().fetchUsers();

      expect(useAdminUserStore.getState().users).toHaveLength(1);
      expect(useAdminUserStore.getState().totalCount).toBe(1);
    });

    it('passes search and role filters as query params', async () => {
      (mockedApi.get as jest.Mock).mockResolvedValueOnce({ data: { results: [], count: 0 } });

      await useAdminUserStore.getState().fetchUsers({ search: 'carlos', role: 'customer', page: 3 });

      expect(mockedApi.get).toHaveBeenCalledWith('/admin/users/', {
        headers: { Authorization: 'Bearer fake-token' },
        params: { page: 3, search: 'carlos', role: 'customer' },
      });
    });

    it('omits role param when filter is "all"', async () => {
      (mockedApi.get as jest.Mock).mockResolvedValueOnce({ data: { results: [], count: 0 } });

      await useAdminUserStore.getState().fetchUsers({ role: 'all' });

      const callParams = (mockedApi.get as jest.Mock).mock.calls[0][1].params;
      expect(callParams.role).toBeUndefined();
    });

    it('sets error message on failure', async () => {
      (mockedApi.get as jest.Mock).mockRejectedValueOnce(new Error('Network'));

      await useAdminUserStore.getState().fetchUsers();

      expect(useAdminUserStore.getState().error).toBe('No se pudieron cargar los usuarios.');
      expect(useAdminUserStore.getState().loading).toBe(false);
    });
  });

  describe('fetchById', () => {
    it('sets selected to the fetched user detail', async () => {
      (mockedApi.get as jest.Mock).mockResolvedValueOnce({ data: MOCK_USER_DETAIL });

      await useAdminUserStore.getState().fetchById(7);

      expect(useAdminUserStore.getState().selected).toEqual(MOCK_USER_DETAIL);
      expect(useAdminUserStore.getState().loading).toBe(false);
    });

    it('calls the correct endpoint', async () => {
      (mockedApi.get as jest.Mock).mockResolvedValueOnce({ data: MOCK_USER_DETAIL });

      await useAdminUserStore.getState().fetchById(7);

      expect(mockedApi.get).toHaveBeenCalledWith('/admin/users/7/', {
        headers: { Authorization: 'Bearer fake-token' },
      });
    });

    it('sets error on failure', async () => {
      (mockedApi.get as jest.Mock).mockRejectedValueOnce(new Error('Not found'));

      await useAdminUserStore.getState().fetchById(999);

      expect(useAdminUserStore.getState().error).toBe('No se pudo cargar el usuario.');
      expect(useAdminUserStore.getState().loading).toBe(false);
    });
  });

  describe('createUser', () => {
    it('POSTs to /admin/users/ and returns ok: true with user', async () => {
      (mockedApi.post as jest.Mock).mockResolvedValueOnce({ data: MOCK_USER_DETAIL });

      const result = await useAdminUserStore.getState().createUser({
        email: 'nuevo@kore.com',
        first_name: 'Nuevo',
        last_name: 'Usuario',
        role: 'customer',
      });

      expect(result).toEqual({ ok: true, user: MOCK_USER_DETAIL });
      expect(mockedApi.post).toHaveBeenCalledWith(
        '/admin/users/',
        expect.objectContaining({ email: 'nuevo@kore.com' }),
        expect.anything(),
      );
      expect(useAdminUserStore.getState().actionLoading).toBe(false);
    });

    it('returns ok: false with field errors on 400', async () => {
      (mockedApi.post as jest.Mock).mockRejectedValueOnce({
        response: { data: { email: ['Ya existe un usuario con este correo.'] } },
      });

      const result = await useAdminUserStore.getState().createUser({
        email: 'existente@kore.com',
        first_name: 'A',
        last_name: 'B',
        role: 'customer',
      });

      expect(result).toEqual({
        ok: false,
        errors: { email: ['Ya existe un usuario con este correo.'] },
      });
      expect(useAdminUserStore.getState().actionLoading).toBe(false);
    });

    it('returns empty errors object when error has no response data', async () => {
      (mockedApi.post as jest.Mock).mockRejectedValueOnce(new Error('Network'));

      const result = await useAdminUserStore.getState().createUser({
        email: 'test@kore.com',
        first_name: 'T',
        last_name: 'U',
        role: 'customer',
      });

      expect(result).toEqual({ ok: false, errors: {} });
    });
  });

  describe('patchUser', () => {
    it('PATCHes user and updates selected, returns ok: true', async () => {
      const updated = { ...MOCK_USER_DETAIL, first_name: 'Carlos Editado' };
      (mockedApi.patch as jest.Mock).mockResolvedValueOnce({ data: updated });

      const result = await useAdminUserStore.getState().patchUser(7, { first_name: 'Carlos Editado' });

      expect(result).toEqual({ ok: true });
      expect(useAdminUserStore.getState().selected).toEqual(updated);
      expect(useAdminUserStore.getState().actionLoading).toBe(false);
    });

    it('returns ok: false with errors on failure', async () => {
      (mockedApi.patch as jest.Mock).mockRejectedValueOnce({
        response: { data: { phone: ['Número inválido.'] } },
      });

      const result = await useAdminUserStore.getState().patchUser(7, { phone: 'abc' });

      expect(result).toEqual({ ok: false, errors: { phone: ['Número inválido.'] } });
      expect(useAdminUserStore.getState().actionLoading).toBe(false);
    });
  });

  describe('resetUserPassword', () => {
    it('POSTs to reset-password then refetches user detail, returns true', async () => {
      (mockedApi.post as jest.Mock).mockResolvedValueOnce({});
      (mockedApi.get as jest.Mock).mockResolvedValueOnce({ data: MOCK_USER_DETAIL });

      const result = await useAdminUserStore.getState().resetUserPassword(7);

      expect(result).toBe(true);
      expect(mockedApi.post).toHaveBeenCalledWith(
        '/admin/users/7/reset-password/',
        {},
        expect.anything(),
      );
      expect(mockedApi.get).toHaveBeenCalledWith('/admin/users/7/', expect.anything());
      expect(useAdminUserStore.getState().actionLoading).toBe(false);
    });

    it('returns false and sets error when resetUserPassword fails', async () => {
      (mockedApi.post as jest.Mock).mockRejectedValueOnce(new Error('Server error'));

      const result = await useAdminUserStore.getState().resetUserPassword(7);

      expect(result).toBe(false);
      expect(useAdminUserStore.getState().error).toBe('No se pudo reenviar la contraseña.');
      expect(useAdminUserStore.getState().actionLoading).toBe(false);
    });
  });

  describe('toggleActive', () => {
    it('POSTs to toggle-active and updates selected, returns true', async () => {
      const toggled = { ...MOCK_USER_DETAIL, is_active: false };
      (mockedApi.post as jest.Mock).mockResolvedValueOnce({ data: toggled });

      const result = await useAdminUserStore.getState().toggleActive(7);

      expect(result).toBe(true);
      expect(mockedApi.post).toHaveBeenCalledWith(
        '/admin/users/7/toggle-active/',
        {},
        expect.anything(),
      );
      expect(useAdminUserStore.getState().selected).toEqual(toggled);
      expect(useAdminUserStore.getState().actionLoading).toBe(false);
    });

    it('returns false and sets error when toggleActive fails', async () => {
      (mockedApi.post as jest.Mock).mockRejectedValueOnce(new Error('Server error'));

      const result = await useAdminUserStore.getState().toggleActive(7);

      expect(result).toBe(false);
      expect(useAdminUserStore.getState().error).toBe('No se pudo actualizar el estado del usuario.');
    });
  });

  describe('deleteUser', () => {
    it('DELETEs user and removes from users array, returns true', async () => {
      useAdminUserStore.setState({ users: [MOCK_USER], totalCount: 1 });
      (mockedApi.delete as jest.Mock).mockResolvedValueOnce({});

      const result = await useAdminUserStore.getState().deleteUser(7);

      expect(result).toBe(true);
      expect(mockedApi.delete).toHaveBeenCalledWith('/admin/users/7/', expect.anything());
      expect(useAdminUserStore.getState().users).toHaveLength(0);
      expect(useAdminUserStore.getState().actionLoading).toBe(false);
    });

    it('returns false and sets error when deleteUser fails', async () => {
      (mockedApi.delete as jest.Mock).mockRejectedValueOnce(new Error('Forbidden'));

      const result = await useAdminUserStore.getState().deleteUser(7);

      expect(result).toBe(false);
      expect(useAdminUserStore.getState().error).toBe('No se pudo eliminar el usuario.');
    });
  });

  describe('setFilters', () => {
    it('merges partial filters preserving untouched fields', () => {
      useAdminUserStore.getState().setFilters({ search: 'ana', page: 2 });

      const { filters } = useAdminUserStore.getState();
      expect(filters.search).toBe('ana');
      expect(filters.page).toBe(2);
      expect(filters.role).toBe('all');
    });
  });
});
