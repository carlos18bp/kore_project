import Cookies from 'js-cookie';
import { useAnthropometryStore } from '@/lib/stores/anthropometryStore';
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
    put: jest.fn(),
    delete: jest.fn(),
  },
}));

const mockedApi = api as jest.Mocked<typeof api>;

function resetStore() {
  useAnthropometryStore.setState({
    evaluations: [],
    loading: false,
    submitting: false,
    error: '',
  });
}

const MOCK_EVALUATION = {
  id: 1,
  customer_id: 10,
  trainer_name: 'Germán Franco',
  evaluation_date: '2025-01-15',
  weight_kg: '75.0',
  height_cm: '175.0',
  waist_cm: '80.0',
  hip_cm: '95.0',
  perimeters: { cintura: 80, gluteos: 95 },
  skinfolds: { triceps: 12 },
  notes: 'Good progress',
  recommendations: {},
  age_at_evaluation: 30,
  bmi: '24.5',
  bmi_category: 'Normal',
  bmi_color: 'green',
  waist_hip_ratio: '0.84',
  whr_risk: 'Bajo',
  whr_color: 'green',
  waist_height_ratio: '0.46',
  whe_risk: 'Bajo',
  whe_color: 'green',
  body_fat_pct: '18.0',
  bf_category: 'Normal',
  bf_color: 'green',
  bf_method: 'skinfolds',
  fat_mass_kg: '13.5',
  lean_mass_kg: '61.5',
  waist_risk: 'Bajo',
  waist_risk_color: 'green',
  sum_skinfolds: '42.0',
  asymmetries: {},
  created_at: '2025-01-15T12:00:00Z',
};

const MOCK_FORM_DATA = {
  evaluation_date: '2025-01-15',
  weight_kg: '75.0',
  height_cm: '175.0',
  waist_cm: '80.0',
  hip_cm: '95.0',
  perimeters: { cintura: '80', gluteos: '95' },
  skinfolds: { triceps: '12' },
  notes: 'Good progress',
};

describe('anthropometryStore', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    resetStore();
    (Cookies.get as jest.Mock).mockReturnValue('fake-token');
  });

  describe('fetchEvaluations', () => {
    it('populates evaluations on success', async () => {
      mockedApi.get.mockResolvedValueOnce({ data: [MOCK_EVALUATION] });
      await useAnthropometryStore.getState().fetchEvaluations(10);
      const state = useAnthropometryStore.getState();
      expect(state.evaluations).toHaveLength(1);
      expect(state.evaluations[0].bmi).toBe('24.5');
      expect(state.loading).toBe(false);
      expect(mockedApi.get).toHaveBeenCalledWith('/trainer/my-clients/10/anthropometry/', {
        headers: { Authorization: 'Bearer fake-token' },
      });
    });

    it('sets error on failure', async () => {
      mockedApi.get.mockRejectedValueOnce(new Error('Network'));
      await useAnthropometryStore.getState().fetchEvaluations(10);
      expect(useAnthropometryStore.getState().error).toBe('No se pudieron cargar las evaluaciones.');
      expect(useAnthropometryStore.getState().loading).toBe(false);
    });
  });

  describe('createEvaluation', () => {
    it('prepends new evaluation to list on success', async () => {
      useAnthropometryStore.setState({ evaluations: [MOCK_EVALUATION] });
      const newEval = { ...MOCK_EVALUATION, id: 2 };
      mockedApi.post.mockResolvedValueOnce({ data: newEval });
      const result = await useAnthropometryStore.getState().createEvaluation(10, MOCK_FORM_DATA);
      const state = useAnthropometryStore.getState();
      expect(result).toEqual(newEval);
      expect(state.evaluations).toHaveLength(2);
      expect(state.evaluations[0].id).toBe(2);
      expect(state.submitting).toBe(false);
    });

    it('sends parsed payload with perimeters and skinfolds', async () => {
      mockedApi.post.mockResolvedValueOnce({ data: MOCK_EVALUATION });
      await useAnthropometryStore.getState().createEvaluation(10, MOCK_FORM_DATA);
      expect(mockedApi.post).toHaveBeenCalledWith(
        '/trainer/my-clients/10/anthropometry/',
        expect.objectContaining({
          weight_kg: 75.0,
          height_cm: 175.0,
          perimeters: { cintura: 80, gluteos: 95 },
          skinfolds: { triceps: 12 },
        }),
        { headers: { Authorization: 'Bearer fake-token' } },
      );
    });

    it('returns null and sets error on failure', async () => {
      mockedApi.post.mockRejectedValueOnce(new Error('Network'));
      const result = await useAnthropometryStore.getState().createEvaluation(10, MOCK_FORM_DATA);
      expect(result).toBeNull();
      expect(useAnthropometryStore.getState().error).toBe('No se pudo guardar la evaluación.');
      expect(useAnthropometryStore.getState().submitting).toBe(false);
    });

    it('extracts detail from error response', async () => {
      mockedApi.post.mockRejectedValueOnce({ response: { data: { detail: 'Validation failed.' } } });
      const result = await useAnthropometryStore.getState().createEvaluation(10, MOCK_FORM_DATA);
      expect(result).toBeNull();
      expect(useAnthropometryStore.getState().error).toBe('Validation failed.');
    });

    it('skips empty perimeters and skinfolds', async () => {
      mockedApi.post.mockResolvedValueOnce({ data: MOCK_EVALUATION });
      const formWithEmpty = { ...MOCK_FORM_DATA, perimeters: { cintura: '', gluteos: '' }, skinfolds: { triceps: '' } };
      await useAnthropometryStore.getState().createEvaluation(10, formWithEmpty);
      expect(mockedApi.post).toHaveBeenCalledWith(
        '/trainer/my-clients/10/anthropometry/',
        expect.objectContaining({
          perimeters: {},
          skinfolds: {},
        }),
        expect.anything(),
      );
    });
  });

  describe('updateEvaluation', () => {
    it('updates evaluation in list on success', async () => {
      useAnthropometryStore.setState({ evaluations: [MOCK_EVALUATION] });
      const updated = { ...MOCK_EVALUATION, notes: 'Updated' };
      mockedApi.patch.mockResolvedValueOnce({ data: updated });
      const result = await useAnthropometryStore.getState().updateEvaluation(10, 1, { notes: 'Updated' });
      expect(result).toEqual(updated);
      expect(useAnthropometryStore.getState().evaluations[0].notes).toBe('Updated');
      expect(useAnthropometryStore.getState().submitting).toBe(false);
    });

    it('sets error on failure', async () => {
      mockedApi.patch.mockRejectedValueOnce(new Error('Network'));
      const result = await useAnthropometryStore.getState().updateEvaluation(10, 1, { notes: 'x' });
      expect(result).toBeNull();
      expect(useAnthropometryStore.getState().error).toBe('No se pudieron guardar las recomendaciones.');
    });
  });

  describe('fullUpdateEvaluation', () => {
    it('replaces evaluation in list on success', async () => {
      useAnthropometryStore.setState({ evaluations: [MOCK_EVALUATION] });
      const updated = { ...MOCK_EVALUATION, weight_kg: '80.0' };
      mockedApi.put.mockResolvedValueOnce({ data: updated });
      const result = await useAnthropometryStore.getState().fullUpdateEvaluation(10, 1, MOCK_FORM_DATA);
      expect(result).toEqual(updated);
      expect(useAnthropometryStore.getState().evaluations[0].weight_kg).toBe('80.0');
      expect(useAnthropometryStore.getState().submitting).toBe(false);
    });

    it('returns null and sets error on failure', async () => {
      mockedApi.put.mockRejectedValueOnce(new Error('Network'));
      const result = await useAnthropometryStore.getState().fullUpdateEvaluation(10, 1, MOCK_FORM_DATA);
      expect(result).toBeNull();
      expect(useAnthropometryStore.getState().error).toBe('No se pudo actualizar la evaluación.');
    });

    it('extracts detail from error response', async () => {
      mockedApi.put.mockRejectedValueOnce({ response: { data: { detail: 'Invalid data.' } } });
      const result = await useAnthropometryStore.getState().fullUpdateEvaluation(10, 1, MOCK_FORM_DATA);
      expect(result).toBeNull();
      expect(useAnthropometryStore.getState().error).toBe('Invalid data.');
    });
  });

  describe('deleteEvaluation', () => {
    it('removes evaluation from list on success', async () => {
      useAnthropometryStore.setState({ evaluations: [MOCK_EVALUATION] });
      mockedApi.delete.mockResolvedValueOnce({});
      const result = await useAnthropometryStore.getState().deleteEvaluation(10, 1);
      expect(result).toBe(true);
      expect(useAnthropometryStore.getState().evaluations).toHaveLength(0);
      expect(useAnthropometryStore.getState().submitting).toBe(false);
    });

    it('sets error on failure', async () => {
      mockedApi.delete.mockRejectedValueOnce(new Error('Network'));
      const result = await useAnthropometryStore.getState().deleteEvaluation(10, 1);
      expect(result).toBe(false);
      expect(useAnthropometryStore.getState().error).toBe('No se pudo eliminar la evaluación.');
    });
  });

  describe('authHeaders branch - no token', () => {
    it('sends empty headers when no token cookie exists', async () => {
      (Cookies.get as jest.Mock).mockReturnValue(undefined);
      mockedApi.get.mockResolvedValueOnce({ data: [] });
      await useAnthropometryStore.getState().fetchEvaluations(10);
      expect(mockedApi.get).toHaveBeenCalledWith('/trainer/my-clients/10/anthropometry/', {
        headers: {},
      });
    });
  });

  describe('createEvaluation branch coverage', () => {
    it('falls back waist_cm from perimeters.cintura when top-level waist_cm is empty', async () => {
      mockedApi.post.mockResolvedValueOnce({ data: MOCK_EVALUATION });
      const form = { ...MOCK_FORM_DATA, waist_cm: '', hip_cm: '', perimeters: { cintura: '85', gluteos: '100' }, skinfolds: {} };
      await useAnthropometryStore.getState().createEvaluation(10, form);
      expect(mockedApi.post).toHaveBeenCalledWith(
        '/trainer/my-clients/10/anthropometry/',
        expect.objectContaining({ waist_cm: 85, hip_cm: 100 }),
        expect.anything(),
      );
    });

    it('omits waist_cm and hip_cm when both are zero or empty', async () => {
      mockedApi.post.mockResolvedValueOnce({ data: MOCK_EVALUATION });
      const form = { ...MOCK_FORM_DATA, waist_cm: '', hip_cm: '', perimeters: {}, skinfolds: {} };
      await useAnthropometryStore.getState().createEvaluation(10, form);
      const payload = mockedApi.post.mock.calls[0][1] as Record<string, unknown>;
      expect(payload).not.toHaveProperty('waist_cm');
      expect(payload).not.toHaveProperty('hip_cm');
    });

    it('sends evaluation_date as undefined when empty', async () => {
      mockedApi.post.mockResolvedValueOnce({ data: MOCK_EVALUATION });
      const form = { ...MOCK_FORM_DATA, evaluation_date: '' };
      await useAnthropometryStore.getState().createEvaluation(10, form);
      const payload = mockedApi.post.mock.calls[0][1] as Record<string, unknown>;
      expect(payload.evaluation_date).toBeUndefined();
    });

    it('uses empty fallback when perimeters, skinfolds, and notes are undefined', async () => {
      mockedApi.post.mockResolvedValueOnce({ data: MOCK_EVALUATION });
      const form = {
        evaluation_date: '2025-01-15',
        weight_kg: '75.0',
        height_cm: '175.0',
        waist_cm: '80.0',
        hip_cm: '95.0',
        perimeters: undefined as unknown as Record<string, string>,
        skinfolds: undefined as unknown as Record<string, string>,
        notes: undefined as unknown as string,
      };
      await useAnthropometryStore.getState().createEvaluation(10, form);
      const payload = mockedApi.post.mock.calls[0][1] as Record<string, unknown>;
      expect(payload.notes).toBe('');
      expect(payload.perimeters).toEqual({});
      expect(payload.skinfolds).toEqual({});
    });
  });

  describe('fullUpdateEvaluation branch coverage', () => {
    it('falls back waist/hip from perimeters when top-level empty', async () => {
      useAnthropometryStore.setState({ evaluations: [MOCK_EVALUATION] });
      mockedApi.put.mockResolvedValueOnce({ data: MOCK_EVALUATION });
      const form = { ...MOCK_FORM_DATA, waist_cm: '', hip_cm: '', perimeters: { cintura: '85', gluteos: '100' }, skinfolds: {} };
      await useAnthropometryStore.getState().fullUpdateEvaluation(10, 1, form);
      expect(mockedApi.put).toHaveBeenCalledWith(
        '/trainer/my-clients/10/anthropometry/1/',
        expect.objectContaining({ waist_cm: 85, hip_cm: 100 }),
        expect.anything(),
      );
    });

    it('omits waist/hip when all sources are empty', async () => {
      useAnthropometryStore.setState({ evaluations: [MOCK_EVALUATION] });
      mockedApi.put.mockResolvedValueOnce({ data: MOCK_EVALUATION });
      const form = { ...MOCK_FORM_DATA, waist_cm: '', hip_cm: '', perimeters: {}, skinfolds: {} };
      await useAnthropometryStore.getState().fullUpdateEvaluation(10, 1, form);
      const payload = mockedApi.put.mock.calls[0][1] as Record<string, unknown>;
      expect(payload).not.toHaveProperty('waist_cm');
      expect(payload).not.toHaveProperty('hip_cm');
    });

    it('uses empty fallback when perimeters, skinfolds, and notes are undefined in fullUpdate', async () => {
      useAnthropometryStore.setState({ evaluations: [MOCK_EVALUATION] });
      mockedApi.put.mockResolvedValueOnce({ data: MOCK_EVALUATION });
      const form = {
        evaluation_date: '2025-01-15',
        weight_kg: '75.0',
        height_cm: '175.0',
        waist_cm: '80.0',
        hip_cm: '95.0',
        perimeters: undefined as unknown as Record<string, string>,
        skinfolds: undefined as unknown as Record<string, string>,
        notes: undefined as unknown as string,
      };
      await useAnthropometryStore.getState().fullUpdateEvaluation(10, 1, form);
      const payload = mockedApi.put.mock.calls[0][1] as Record<string, unknown>;
      expect(payload.notes).toBe('');
      expect(payload.perimeters).toEqual({});
      expect(payload.skinfolds).toEqual({});
    });

    it('skips empty skinfold and perimeter values in fullUpdate', async () => {
      useAnthropometryStore.setState({ evaluations: [MOCK_EVALUATION] });
      mockedApi.put.mockResolvedValueOnce({ data: MOCK_EVALUATION });
      const form = { ...MOCK_FORM_DATA, perimeters: { cintura: '', brazo: '30' }, skinfolds: { triceps: '', biceps: '8' } };
      await useAnthropometryStore.getState().fullUpdateEvaluation(10, 1, form);
      expect(mockedApi.put).toHaveBeenCalledWith(
        '/trainer/my-clients/10/anthropometry/1/',
        expect.objectContaining({
          perimeters: { brazo: 30 },
          skinfolds: { biceps: 8 },
        }),
        expect.anything(),
      );
    });
  });

  describe('fetchMyEvaluations', () => {
    it('populates evaluations from customer endpoint', async () => {
      mockedApi.get.mockResolvedValueOnce({ data: [MOCK_EVALUATION] });
      await useAnthropometryStore.getState().fetchMyEvaluations();
      const state = useAnthropometryStore.getState();
      expect(state.evaluations).toHaveLength(1);
      expect(state.loading).toBe(false);
      expect(mockedApi.get).toHaveBeenCalledWith('/my-anthropometry/', {
        headers: { Authorization: 'Bearer fake-token' },
      });
    });

    it('sets error on failure', async () => {
      mockedApi.get.mockRejectedValueOnce(new Error('Network'));
      await useAnthropometryStore.getState().fetchMyEvaluations();
      expect(useAnthropometryStore.getState().error).toBe('No se pudieron cargar tus evaluaciones.');
      expect(useAnthropometryStore.getState().loading).toBe(false);
    });
  });
});
