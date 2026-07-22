import Cookies from 'js-cookie';
import { useTrainerStore } from '@/lib/stores/trainerStore';
import { api } from '@/lib/services/http';

jest.mock('js-cookie', () => ({ get: jest.fn(), set: jest.fn(), remove: jest.fn() }));
jest.mock('@/lib/services/http', () => ({
  api: { get: jest.fn(), post: jest.fn(), patch: jest.fn(), delete: jest.fn() },
}));

const mockedApi = api as jest.Mocked<typeof api>;

function resetStore() {
  useTrainerStore.setState({
    clientAlerts: {},
    clientAlertsLoading: false,
    clientNutritionLogs: {},
    nutritionLogsLoading: false,
    programActionLoading: false,
    agendaSessions: [],
    agendaLoading: false,
    blockedDates: new Set<string>(),
    blockedReasons: {},
    blockedDatesLoading: false,
    trainerMessages: {},
    clientMonthlyPrograms: {},
    clientNutritionWeekNotes: {},
  });
}

describe('trainerStore — gap actions', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    resetStore();
    (Cookies.get as jest.Mock).mockReturnValue('tok');
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

  describe('fetchAgendaSessions', () => {
    it('stores the agenda sessions from the response', async () => {
      const sessions = [
        { id: 9, customer_name: 'Ana', customer_id: 2, package_title: 'Gold', starts_at: '2026-07-01T10:00:00Z', ends_at: '2026-07-01T11:00:00Z', status: 'confirmed' },
      ];
      mockedApi.get.mockResolvedValueOnce({ data: { sessions } });

      await useTrainerStore.getState().fetchAgendaSessions('2026-07-01', '2026-07-07');

      expect(mockedApi.get).toHaveBeenCalledWith(
        '/trainer/agenda/',
        expect.objectContaining({ params: { from: '2026-07-01', to: '2026-07-07' } }),
      );
      expect(useTrainerStore.getState().agendaSessions).toEqual(sessions);
      expect(useTrainerStore.getState().agendaLoading).toBe(false);
    });
  });

  describe('fetchBlockedDates', () => {
    it('builds the blocked set plus the per-date reasons map from the response', async () => {
      mockedApi.get.mockResolvedValueOnce({
        data: {
          dates: ['2026-07-10', '2026-07-11'],
          details: [
            { date: '2026-07-10', reason: 'Vacaciones' },
            { date: '2026-07-11', reason: '' },
          ],
        },
      });

      await useTrainerStore.getState().fetchBlockedDates('2026-07-01', '2026-07-31');

      expect(mockedApi.get).toHaveBeenCalledWith(
        '/trainer/unavailability/',
        expect.objectContaining({ params: { date_from: '2026-07-01', date_to: '2026-07-31' } }),
      );
      const state = useTrainerStore.getState();
      expect(Array.from(state.blockedDates).sort()).toEqual(['2026-07-10', '2026-07-11']);
      expect(state.blockedReasons).toEqual({ '2026-07-10': 'Vacaciones' });
      expect(state.blockedDatesLoading).toBe(false);
    });
  });

  describe('blockDate', () => {
    it('registers the date with its reason after a successful POST', async () => {
      mockedApi.post.mockResolvedValueOnce({ data: {} });

      const ok = await useTrainerStore.getState().blockDate('2026-07-15', 'Congreso');

      expect(ok).toBe(true);
      expect(mockedApi.post).toHaveBeenCalledWith(
        '/trainer/unavailability/',
        { date: '2026-07-15', reason: 'Congreso' },
        expect.anything(),
      );
      expect(useTrainerStore.getState().blockedDates.has('2026-07-15')).toBe(true);
      expect(useTrainerStore.getState().blockedReasons['2026-07-15']).toBe('Congreso');
    });
  });

  describe('unblockDate', () => {
    it('drops the date from the blocked set after a successful DELETE', async () => {
      useTrainerStore.setState({
        blockedDates: new Set(['2026-07-15']),
        blockedReasons: { '2026-07-15': 'Congreso' },
      });
      mockedApi.delete.mockResolvedValueOnce({ data: {} });

      const ok = await useTrainerStore.getState().unblockDate('2026-07-15');

      expect(ok).toBe(true);
      expect(mockedApi.delete).toHaveBeenCalledWith(
        '/trainer/unavailability/',
        expect.objectContaining({ params: { date: '2026-07-15' } }),
      );
      expect(useTrainerStore.getState().blockedDates.has('2026-07-15')).toBe(false);
      expect(useTrainerStore.getState().blockedReasons['2026-07-15']).toBeUndefined();
    });
  });

  describe('updateTrainerMessage', () => {
    it('rewrites the matching keyed message text from the PATCH response', async () => {
      useTrainerStore.setState({
        trainerMessages: {
          3: [{ id: 8, customer_id: 3, trigger_type: 'manual', message: 'viejo', is_visible: true, seen_by_customer: false, created_at: '2026-07-01T10:00:00Z' }],
        },
      });
      mockedApi.patch.mockResolvedValueOnce({ data: { message: 'nuevo', trigger_type: 'post_session' } });

      await useTrainerStore.getState().updateTrainerMessage(3, 8, 'nuevo');

      expect(mockedApi.patch).toHaveBeenCalledWith(
        '/trainer/messages/8/',
        { message: 'nuevo' },
        expect.anything(),
      );
      expect(useTrainerStore.getState().trainerMessages[3][0].message).toBe('nuevo');
      expect(useTrainerStore.getState().trainerMessages[3][0].trigger_type).toBe('post_session');
    });
  });

  describe('deleteTrainerMessage', () => {
    it('removes only the matching keyed message after the DELETE call', async () => {
      useTrainerStore.setState({
        trainerMessages: {
          3: [
            { id: 8, customer_id: 3, trigger_type: 'manual', message: 'uno', is_visible: true, seen_by_customer: false, created_at: '2026-07-01T10:00:00Z' },
            { id: 9, customer_id: 3, trigger_type: 'manual', message: 'dos', is_visible: true, seen_by_customer: false, created_at: '2026-07-02T10:00:00Z' },
          ],
        },
      });
      mockedApi.delete.mockResolvedValueOnce({ data: {} });

      await useTrainerStore.getState().deleteTrainerMessage(3, 8);

      expect(mockedApi.delete).toHaveBeenCalledWith('/trainer/messages/8/', expect.anything());
      expect(useTrainerStore.getState().trainerMessages[3].map((m) => m.id)).toEqual([9]);
    });
  });

  describe('updateProgramWeekNote', () => {
    it('upserts the week note into the matching program sorted by week number', async () => {
      useTrainerStore.setState({
        clientMonthlyPrograms: {
          3: [{
            id: 50, start_date: '2026-07-01', end_date: '2026-07-28', status: 'published',
            goal: 'strength', fitness_level: 2, trainer_notes: '',
            week_notes: [{ week_number: 2, notes: 'previa', updated_at: '2026-07-08T10:00:00Z' }],
            approved_at: null, is_paused: false,
          }],
        },
      });
      mockedApi.patch.mockResolvedValueOnce({ data: {} });

      await useTrainerStore.getState().updateProgramWeekNote(3, 50, 1, 'semana uno');

      expect(mockedApi.patch).toHaveBeenCalledWith(
        '/monthly-programs/50/week-notes/1/',
        { notes: 'semana uno' },
        expect.anything(),
      );
      const weekNotes = useTrainerStore.getState().clientMonthlyPrograms[3][0].week_notes;
      expect(weekNotes.map((w) => [w.week_number, w.notes])).toEqual([
        [1, 'semana uno'],
        [2, 'previa'],
      ]);
    });
  });

  describe('updateNutritionWeekNote', () => {
    it('replaces the stored note for the same cycle week keeping the others', async () => {
      useTrainerStore.setState({
        clientNutritionWeekNotes: {
          3: [
            { id: 1, cycle_number: 1, cycle_start: '2026-07-01', week_number: 1, notes: 'vieja', updated_at: '2026-07-02T10:00:00Z' },
            { id: 2, cycle_number: 1, cycle_start: '2026-07-01', week_number: 2, notes: 'otra', updated_at: '2026-07-09T10:00:00Z' },
          ],
        },
      });
      const saved = { id: 1, cycle_number: 1, cycle_start: '2026-07-01', week_number: 1, notes: 'nueva', updated_at: '2026-07-20T10:00:00Z' };
      mockedApi.patch.mockResolvedValueOnce({ data: saved });

      await useTrainerStore.getState().updateNutritionWeekNote(3, 1, 1, 'nueva', '2026-07-01');

      expect(mockedApi.patch).toHaveBeenCalledWith(
        '/nutrition-week-notes/customer/3/1/1/',
        { notes: 'nueva', cycle_start: '2026-07-01' },
        expect.anything(),
      );
      const notes = useTrainerStore.getState().clientNutritionWeekNotes[3];
      expect(notes).toHaveLength(2);
      expect(notes.find((n) => n.week_number === 1)).toEqual(saved);
      expect(notes.find((n) => n.week_number === 2)!.notes).toBe('otra');
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
