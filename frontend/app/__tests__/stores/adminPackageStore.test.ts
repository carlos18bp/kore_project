import Cookies from 'js-cookie';
import { useAdminPackageStore, type AdminPackage } from '@/lib/stores/adminPackageStore';
import { api } from '@/lib/services/http';

jest.mock('js-cookie', () => ({ get: jest.fn(), set: jest.fn(), remove: jest.fn() }));
jest.mock('@/lib/services/http', () => ({
  api: { get: jest.fn(), post: jest.fn(), patch: jest.fn(), delete: jest.fn() },
}));

const mockedApi = api as jest.Mocked<typeof api>;

const MOCK_PACKAGE: AdminPackage = {
  id: 1, title: 'Plan A', short_description: '', description: '', category: 'personalizado',
  sessions_count: 10, session_duration_minutes: 60, price: '300000', currency: 'COP',
  validity_days: 30, terms_and_conditions: '', is_active: true, order: 0,
  created_at: '2026-01-01', updated_at: '2026-01-01',
};

function resetStore() {
  useAdminPackageStore.setState({ packages: [], loading: false, actionLoading: false, error: '' });
}

const VALID_PAYLOAD = {
  title: 'Nuevo', category: 'personalizado' as const, sessions_count: 8,
  session_duration_minutes: 60, price: '200000', validity_days: 30,
};

describe('adminPackageStore', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    resetStore();
    (Cookies.get as jest.Mock).mockReturnValue('tok');
  });

  describe('fetchPackages', () => {
    it('collects packages across paginated pages', async () => {
      mockedApi.get
        .mockResolvedValueOnce({ data: { results: [{ ...MOCK_PACKAGE, id: 1 }], next: 'http://x/?page=2' } })
        .mockResolvedValueOnce({ data: { results: [{ ...MOCK_PACKAGE, id: 2 }], next: null } });

      await useAdminPackageStore.getState().fetchPackages();

      const state = useAdminPackageStore.getState();
      expect(state.packages.map((p) => p.id)).toEqual([1, 2]);
      expect(state.loading).toBe(false);
      expect(mockedApi.get).toHaveBeenNthCalledWith(1, '/packages/', {
        headers: { Authorization: 'Bearer tok' }, params: { page: 1 },
      });
    });

    it('handles a non-paginated array response', async () => {
      mockedApi.get.mockResolvedValueOnce({ data: [MOCK_PACKAGE] });

      await useAdminPackageStore.getState().fetchPackages();

      expect(useAdminPackageStore.getState().packages).toHaveLength(1);
    });

    it('sets an error message on failure', async () => {
      mockedApi.get.mockRejectedValueOnce(new Error('boom'));

      await useAdminPackageStore.getState().fetchPackages();

      expect(useAdminPackageStore.getState().error).toBe('No se pudieron cargar los planes.');
      expect(useAdminPackageStore.getState().loading).toBe(false);
    });
  });

  describe('createPackage', () => {
    it('appends the created package and returns ok', async () => {
      mockedApi.post.mockResolvedValueOnce({ data: { ...MOCK_PACKAGE, id: 5, title: 'Nuevo' } });

      const result = await useAdminPackageStore.getState().createPackage(VALID_PAYLOAD);

      expect(result).toEqual({ ok: true, pkg: expect.objectContaining({ id: 5 }) });
      expect(useAdminPackageStore.getState().packages.map((p) => p.id)).toContain(5);
    });

    it('returns the detail error message on failure', async () => {
      mockedApi.post.mockRejectedValueOnce({ response: { data: { detail: 'Precio inválido' } } });

      const result = await useAdminPackageStore.getState().createPackage(VALID_PAYLOAD);

      expect(result).toEqual({ ok: false, error: 'Precio inválido' });
      expect(useAdminPackageStore.getState().error).toBe('Precio inválido');
    });

    it('returns the first field error when no detail is present', async () => {
      mockedApi.post.mockRejectedValueOnce({ response: { data: { price: ['debe ser positivo'] } } });

      const result = await useAdminPackageStore.getState().createPackage(VALID_PAYLOAD);

      expect(result).toEqual({ ok: false, error: 'price: debe ser positivo' });
    });
  });

  describe('updatePackage', () => {
    it('replaces the package on success', async () => {
      useAdminPackageStore.setState({ packages: [MOCK_PACKAGE] });
      mockedApi.patch.mockResolvedValueOnce({ data: { ...MOCK_PACKAGE, title: 'Editado' } });

      const result = await useAdminPackageStore.getState().updatePackage(1, { title: 'Editado' });

      expect(result.ok).toBe(true);
      expect(useAdminPackageStore.getState().packages[0].title).toBe('Editado');
    });

    it('returns an error on failure', async () => {
      useAdminPackageStore.setState({ packages: [MOCK_PACKAGE] });
      mockedApi.patch.mockRejectedValueOnce(new Error('boom'));

      const result = await useAdminPackageStore.getState().updatePackage(1, { title: 'X' });

      expect(result).toEqual({ ok: false, error: 'No se pudo actualizar el plan.' });
    });
  });

  describe('toggleActive', () => {
    it('optimistically toggles then confirms with the server value', async () => {
      useAdminPackageStore.setState({ packages: [MOCK_PACKAGE] });
      mockedApi.patch.mockResolvedValueOnce({ data: { ...MOCK_PACKAGE, is_active: false } });

      const ok = await useAdminPackageStore.getState().toggleActive(1, false);

      expect(ok).toBe(true);
      expect(useAdminPackageStore.getState().packages[0].is_active).toBe(false);
    });

    it('rolls back to the previous state on failure', async () => {
      useAdminPackageStore.setState({ packages: [MOCK_PACKAGE] });
      mockedApi.patch.mockRejectedValueOnce(new Error('boom'));

      const ok = await useAdminPackageStore.getState().toggleActive(1, false);

      expect(ok).toBe(false);
      expect(useAdminPackageStore.getState().packages[0].is_active).toBe(true);
      expect(useAdminPackageStore.getState().error).toBe('No se pudo cambiar el estado del plan.');
    });
  });
});
