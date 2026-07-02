jest.mock('js-cookie', () => ({ get: jest.fn(() => 'tok'), set: jest.fn(), remove: jest.fn() }));
jest.mock('@/lib/services/http', () => ({
  api: { get: jest.fn(), post: jest.fn(), patch: jest.fn(), delete: jest.fn() },
  getWithRetry: jest.fn(),
  extractApiError: jest.fn((_e: unknown, fb: string) => fb),
}));

import { useTrainerStore } from '@/lib/stores/trainerStore';

describe('trainerStore.markSessionAttendance', () => {
  it('patches the matching session in agenda and client lists', () => {
    useTrainerStore.setState({
      agendaSessions: [
        { id: 7, customer_name: 'Ana', customer_id: 1, package_title: 'P', starts_at: 'x', ends_at: 'y', status: 'confirmed', attendance_status: 'unset' },
      ] as never,
      clientSessions: [
        { id: 7, status: 'confirmed', package_title: 'P', starts_at: 'x', ends_at: 'y', notes: '', canceled_reason: '', session_objective: '', session_notes_for_customer: '', created_at: 'z', attendance_status: 'unset' },
      ] as never,
    });
    useTrainerStore.getState().markSessionAttendance(7, 'attended');
    expect(useTrainerStore.getState().agendaSessions[0].attendance_status).toBe('attended');
    expect(useTrainerStore.getState().clientSessions[0].attendance_status).toBe('attended');
  });
});
