import Cookies from 'js-cookie';
import { useAdminUserStore } from '@/lib/stores/adminUserStore';
import type { AdminUserDetail } from '@/lib/stores/adminUserStore';
import { api } from '@/lib/services/http';

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
    delete: jest.fn(),
  },
}));

const mockedApi = api as jest.Mocked<typeof api>;

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

describe('adminUserStore.assignTrainer / fetchAssignmentSummary', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    resetStore();
    (Cookies.get as jest.Mock).mockReturnValue('fake-token');
  });

  describe('assignTrainer', () => {
    it('PATCHes assigned_trainer_id and returns ok', async () => {
      (mockedApi.patch as jest.Mock).mockResolvedValueOnce({
        data: {
          id: 5,
          role: 'customer',
          assigned_trainer: { id: 3, first_name: 'T', last_name: 'A' },
        },
      });
      const res = await useAdminUserStore.getState().assignTrainer(5, 3);
      expect(mockedApi.patch).toHaveBeenCalledWith(
        '/admin/users/5/',
        { assigned_trainer_id: 3 },
        expect.anything(),
      );
      expect(res).toEqual({ ok: true });
    });

    it('updates selected if it matches the customerId', async () => {
      const updatedUser = {
        id: 5,
        role: 'customer',
        assigned_trainer: { id: 3, first_name: 'T', last_name: 'A' },
        assigned_clients: null,
        subscriptions: [],
      };
      (mockedApi.patch as jest.Mock).mockResolvedValueOnce({ data: updatedUser });
      // pre-set selected to the same user
      useAdminUserStore.setState({ selected: { ...updatedUser, assigned_trainer: null } as AdminUserDetail });
      await useAdminUserStore.getState().assignTrainer(5, 3);
      expect(useAdminUserStore.getState().selected).toEqual(updatedUser);
    });

    it('does not update selected if it belongs to a different user', async () => {
      const updatedUser = {
        id: 5,
        role: 'customer',
        assigned_trainer: { id: 3, first_name: 'T', last_name: 'A' },
        assigned_clients: null,
        subscriptions: [],
      };
      (mockedApi.patch as jest.Mock).mockResolvedValueOnce({ data: updatedUser });
      const otherUser = { id: 99, role: 'customer', assigned_trainer: null, assigned_clients: null, subscriptions: [] } as AdminUserDetail;
      useAdminUserStore.setState({ selected: otherUser });
      await useAdminUserStore.getState().assignTrainer(5, 3);
      expect(useAdminUserStore.getState().selected).toEqual(otherUser);
    });

    it('returns ok: false with errors on failure', async () => {
      (mockedApi.patch as jest.Mock).mockRejectedValueOnce({
        response: { data: { assigned_trainer_id: ['Invalid trainer.'] } },
      });
      const res = await useAdminUserStore.getState().assignTrainer(5, 99);
      expect(res).toEqual({ ok: false, errors: { assigned_trainer_id: ['Invalid trainer.'] } });
      expect(useAdminUserStore.getState().actionLoading).toBe(false);
    });

    it('unassigns trainer when trainerId is null', async () => {
      (mockedApi.patch as jest.Mock).mockResolvedValueOnce({
        data: { id: 5, role: 'customer', assigned_trainer: null },
      });
      const res = await useAdminUserStore.getState().assignTrainer(5, null);
      expect(mockedApi.patch).toHaveBeenCalledWith(
        '/admin/users/5/',
        { assigned_trainer_id: null },
        expect.anything(),
      );
      expect(res).toEqual({ ok: true });
    });
  });

  describe('fetchAssignmentSummary', () => {
    it('stores the payload in assignmentSummary', async () => {
      const summary = { active_customers: 2, assigned: 1, unassigned: 1, per_trainer: [] };
      (mockedApi.get as jest.Mock).mockResolvedValueOnce({ data: summary });
      await useAdminUserStore.getState().fetchAssignmentSummary();
      expect(useAdminUserStore.getState().assignmentSummary).toEqual(summary);
      expect(useAdminUserStore.getState().assignmentSummary?.active_customers).toBe(2);
    });

    it('calls the correct endpoint with auth headers', async () => {
      (mockedApi.get as jest.Mock).mockResolvedValueOnce({ data: { active_customers: 0, assigned: 0, unassigned: 0, per_trainer: [] } });
      await useAdminUserStore.getState().fetchAssignmentSummary();
      expect(mockedApi.get).toHaveBeenCalledWith(
        '/admin/trainers/assignment-summary/',
        { headers: { Authorization: 'Bearer fake-token' } },
      );
    });

    it('sets assignmentSummary to null on failure', async () => {
      (mockedApi.get as jest.Mock).mockRejectedValueOnce(new Error('Network'));
      // Pre-set a value to confirm it gets cleared
      useAdminUserStore.setState({ assignmentSummary: { active_customers: 5, assigned: 3, unassigned: 2, per_trainer: [] } });
      await useAdminUserStore.getState().fetchAssignmentSummary();
      expect(useAdminUserStore.getState().assignmentSummary).toBeNull();
    });

    it('per_trainer entries are preserved correctly', async () => {
      const summary = {
        active_customers: 4,
        assigned: 3,
        unassigned: 1,
        per_trainer: [{ trainer_id: 7, first_name: 'Ana', last_name: 'López', client_count: 3 }],
      };
      (mockedApi.get as jest.Mock).mockResolvedValueOnce({ data: summary });
      await useAdminUserStore.getState().fetchAssignmentSummary();
      const stored = useAdminUserStore.getState().assignmentSummary;
      expect(stored?.per_trainer).toHaveLength(1);
      expect(stored?.per_trainer[0].trainer_id).toBe(7);
    });
  });

  describe('reset', () => {
    it('clears assignmentSummary on reset', async () => {
      useAdminUserStore.setState({
        assignmentSummary: { active_customers: 2, assigned: 1, unassigned: 1, per_trainer: [] },
      });
      useAdminUserStore.getState().reset();
      expect(useAdminUserStore.getState().assignmentSummary).toBeNull();
    });
  });
});
