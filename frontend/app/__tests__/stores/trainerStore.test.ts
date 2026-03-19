import Cookies from 'js-cookie';
import { useTrainerStore } from '@/lib/stores/trainerStore';
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
  useTrainerStore.setState({
    clients: [],
    clientsLoading: false,
    selectedClient: null,
    clientLoading: false,
    clientSessions: [],
    sessionsLoading: false,
    dashboardStats: null,
    statsLoading: false,
    error: '',
  });
}

const MOCK_CLIENT = {
  id: 1,
  first_name: 'Carlos',
  last_name: 'Pérez',
  email: 'carlos@test.com',
  avatar_url: null,
  primary_goal: 'Fuerza',
  active_package: 'Gold',
  sessions_remaining: 8,
  total_sessions: 12,
  completed_sessions: 4,
  last_session_date: '2025-02-10',
};

const MOCK_CLIENT_DETAIL = {
  id: 1,
  first_name: 'Carlos',
  last_name: 'Pérez',
  email: 'carlos@test.com',
  phone: '3001234567',
  avatar_url: null,
  date_joined: '2024-06-01',
  profile: {
    sex: 'M',
    date_of_birth: '1990-05-15',
    eps: 'Sura',
    id_type: 'CC',
    id_number: '1234567890',
    id_expedition_date: null,
    address: 'Calle 100',
    city: 'Bogotá',
    primary_goal: 'Fuerza',
    kore_start_date: '2024-06-01',
  },
  subscription: null,
  next_session: null,
  last_payment: null,
  stats: { total: 12, completed: 4, canceled: 1, pending: 0 },
};

const MOCK_SESSION = {
  id: 10,
  status: 'completed',
  package_title: 'Gold',
  starts_at: '2025-02-10T10:00:00Z',
  ends_at: '2025-02-10T11:00:00Z',
  notes: '',
  canceled_reason: '',
  created_at: '2025-02-01T00:00:00Z',
};

const MOCK_DASHBOARD_STATS = {
  total_clients: 5,
  today_sessions: 3,
  upcoming_sessions: [
    {
      id: 20,
      customer_name: 'Carlos Pérez',
      customer_id: 1,
      package_title: 'Gold',
      starts_at: '2025-02-15T10:00:00Z',
      ends_at: '2025-02-15T11:00:00Z',
      status: 'confirmed',
    },
  ],
};

describe('trainerStore', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    resetStore();
    (Cookies.get as jest.Mock).mockReturnValue('fake-token');
  });

  describe('fetchClients', () => {
    it('populates clients on success', async () => {
      mockedApi.get.mockResolvedValueOnce({ data: [MOCK_CLIENT] });
      await useTrainerStore.getState().fetchClients();
      const state = useTrainerStore.getState();
      expect(state.clients).toHaveLength(1);
      expect(state.clients[0].first_name).toBe('Carlos');
      expect(state.clientsLoading).toBe(false);
      expect(mockedApi.get).toHaveBeenCalledWith('/trainer/my-clients/', {
        headers: { Authorization: 'Bearer fake-token' },
      });
    });

    it('sets error on failure', async () => {
      mockedApi.get.mockRejectedValueOnce(new Error('Network'));
      await useTrainerStore.getState().fetchClients();
      expect(useTrainerStore.getState().error).toBe('No se pudieron cargar los clientes.');
      expect(useTrainerStore.getState().clientsLoading).toBe(false);
    });

    it('sends empty auth headers when no token', async () => {
      (Cookies.get as jest.Mock).mockReturnValue(undefined);
      mockedApi.get.mockResolvedValueOnce({ data: [] });
      await useTrainerStore.getState().fetchClients();
      expect(mockedApi.get).toHaveBeenCalledWith('/trainer/my-clients/', { headers: {} });
    });
  });

  describe('fetchClientDetail', () => {
    it('populates selectedClient on success', async () => {
      mockedApi.get.mockResolvedValueOnce({ data: MOCK_CLIENT_DETAIL });
      await useTrainerStore.getState().fetchClientDetail(1);
      const state = useTrainerStore.getState();
      expect(state.selectedClient).toEqual(MOCK_CLIENT_DETAIL);
      expect(state.clientLoading).toBe(false);
      expect(mockedApi.get).toHaveBeenCalledWith('/trainer/my-clients/1/', {
        headers: { Authorization: 'Bearer fake-token' },
      });
    });

    it('sets error on failure', async () => {
      mockedApi.get.mockRejectedValueOnce(new Error('Network'));
      await useTrainerStore.getState().fetchClientDetail(1);
      expect(useTrainerStore.getState().error).toBe('No se pudo cargar la información del cliente.');
      expect(useTrainerStore.getState().clientLoading).toBe(false);
    });
  });

  describe('fetchClientSessions', () => {
    it('populates clientSessions on success', async () => {
      mockedApi.get.mockResolvedValueOnce({ data: [MOCK_SESSION] });
      await useTrainerStore.getState().fetchClientSessions(1);
      const state = useTrainerStore.getState();
      expect(state.clientSessions).toHaveLength(1);
      expect(state.clientSessions[0].status).toBe('completed');
      expect(state.sessionsLoading).toBe(false);
      expect(mockedApi.get).toHaveBeenCalledWith('/trainer/my-clients/1/sessions/', {
        headers: { Authorization: 'Bearer fake-token' },
      });
    });

    it('sets error on failure', async () => {
      mockedApi.get.mockRejectedValueOnce(new Error('Network'));
      await useTrainerStore.getState().fetchClientSessions(1);
      expect(useTrainerStore.getState().error).toBe('No se pudo cargar el historial de sesiones.');
      expect(useTrainerStore.getState().sessionsLoading).toBe(false);
    });
  });

  describe('fetchDashboardStats', () => {
    it('populates dashboardStats on success', async () => {
      mockedApi.get.mockResolvedValueOnce({ data: MOCK_DASHBOARD_STATS });
      await useTrainerStore.getState().fetchDashboardStats();
      const state = useTrainerStore.getState();
      expect(state.dashboardStats).toEqual(MOCK_DASHBOARD_STATS);
      expect(state.dashboardStats!.total_clients).toBe(5);
      expect(state.statsLoading).toBe(false);
      expect(mockedApi.get).toHaveBeenCalledWith('/trainer/dashboard-stats/', {
        headers: { Authorization: 'Bearer fake-token' },
      });
    });

    it('sets error on failure', async () => {
      mockedApi.get.mockRejectedValueOnce(new Error('Network'));
      await useTrainerStore.getState().fetchDashboardStats();
      expect(useTrainerStore.getState().error).toBe('No se pudieron cargar las estadísticas.');
      expect(useTrainerStore.getState().statsLoading).toBe(false);
    });
  });
});
