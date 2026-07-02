jest.mock('js-cookie', () => ({ get: jest.fn(() => 'tok'), set: jest.fn(), remove: jest.fn() }));
jest.mock('@/lib/services/http', () => ({
  api: { get: jest.fn(), post: jest.fn(), patch: jest.fn(), delete: jest.fn() },
  getWithRetry: jest.fn(),
  extractApiError: jest.fn((_e: unknown, fb: string) => fb),
}));

import { api } from '@/lib/services/http';
import { usePhysicalTestStore } from '@/lib/stores/physicalTestStore';

const TEST_ROW = {
  id: 1, customer: 3, trainer: 2, performed_at: '2026-07-15',
  result: 'passed', notes: 'Buen progreso', created_at: '2026-07-15T15:00:00Z',
};

describe('physicalTestStore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    usePhysicalTestStore.setState({ tests: [], loading: false, submitting: false, error: '' });
  });

  it('fetchTests requests the customer filter and stores the list', async () => {
    (api.get as jest.Mock).mockResolvedValue({ data: [TEST_ROW] });
    await usePhysicalTestStore.getState().fetchTests(3);
    expect(api.get).toHaveBeenCalledWith('/trainer/physical-tests/', expect.objectContaining({
      params: { customer: 3 },
    }));
    expect(usePhysicalTestStore.getState().tests).toHaveLength(1);
  });

  it('createTest posts customer + form data and prepends the result', async () => {
    (api.post as jest.Mock).mockResolvedValue({ data: TEST_ROW });
    const created = await usePhysicalTestStore.getState().createTest(3, {
      performed_at: '2026-07-15', result: 'passed', notes: 'Buen progreso',
    });
    expect(api.post).toHaveBeenCalledWith('/trainer/physical-tests/', {
      customer: 3, performed_at: '2026-07-15', result: 'passed', notes: 'Buen progreso',
    }, expect.any(Object));
    expect(created?.id).toBe(1);
    expect(usePhysicalTestStore.getState().tests[0].id).toBe(1);
  });

  it('createTest stores the extracted error on failure', async () => {
    (api.post as jest.Mock).mockRejectedValue(new Error('boom'));
    const created = await usePhysicalTestStore.getState().createTest(3, {
      performed_at: '2026-07-15', result: 'failed', notes: '',
    });
    expect(created).toBeNull();
    expect(usePhysicalTestStore.getState().error).toBe('No se pudo registrar el test físico.');
  });
});
