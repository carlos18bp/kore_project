import Cookies from 'js-cookie';
import { usePhysicalEvaluationStore } from '@/lib/stores/physicalEvaluationStore';
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

function resetStore() {
  usePhysicalEvaluationStore.setState({
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
  age_at_evaluation: 30,
  sex_at_evaluation: 'M',
  squats_reps: 20,
  pushups_reps: 15,
  plank_seconds: 60,
  walk_meters: 500,
  unipodal_seconds: 30,
  hip_mobility: 8,
  shoulder_mobility: 7,
  ankle_mobility: 6,
  squats_notes: '',
  squats_pain: false,
  squats_interrupted: false,
  pushups_notes: '',
  pushups_pain: false,
  plank_notes: '',
  plank_pain: false,
  walk_notes: '',
  walk_effort_perception: 5,
  walk_heart_rate: 120,
  unipodal_notes: '',
  mobility_notes: '',
  notes: '',
  recommendations: {},
  squats_score: 4,
  pushups_score: 3,
  plank_score: 4,
  walk_score: 3,
  unipodal_score: 4,
  strength_index: '75.0',
  strength_category: 'Bueno',
  strength_color: 'green',
  endurance_index: '70.0',
  endurance_category: 'Bueno',
  endurance_color: 'green',
  mobility_index: '65.0',
  mobility_category: 'Regular',
  mobility_color: 'yellow',
  balance_index: '80.0',
  balance_category: 'Bueno',
  balance_color: 'green',
  general_index: '72.5',
  general_category: 'Bueno',
  general_color: 'green',
  cross_module_alerts: {},
  created_at: '2025-01-15T12:00:00Z',
};

const MOCK_FORM_DATA = {
  evaluation_date: '2025-01-15',
  squats_reps: 20,
  pushups_reps: 15,
  plank_seconds: 60,
  walk_meters: 500,
  unipodal_seconds: 30,
  hip_mobility: 8,
  shoulder_mobility: 7,
  ankle_mobility: 6,
  squats_notes: '',
  squats_pain: false,
  squats_interrupted: false,
  pushups_notes: '',
  pushups_pain: false,
  plank_notes: '',
  plank_pain: false,
  walk_notes: '',
  walk_effort_perception: 5,
  walk_heart_rate: 120,
  unipodal_notes: '',
  mobility_notes: '',
  notes: '',
};

describe('physicalEvaluationStore', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    resetStore();
    (Cookies.get as jest.Mock).mockReturnValue('fake-token');
  });

  describe('fetchEvaluations', () => {
    it('populates evaluations on success', async () => {
      mockedApi.get.mockResolvedValueOnce({ data: [MOCK_EVALUATION] });
      await usePhysicalEvaluationStore.getState().fetchEvaluations(10);
      const state = usePhysicalEvaluationStore.getState();
      expect(state.evaluations).toHaveLength(1);
      expect(state.evaluations[0].trainer_name).toBe('Germán Franco');
      expect(state.loading).toBe(false);
      expect(mockedApi.get).toHaveBeenCalledWith('/trainer/my-clients/10/physical-evaluation/', {
        headers: { Authorization: 'Bearer fake-token' },
      });
    });

    it('sets error on failure', async () => {
      mockedApi.get.mockRejectedValueOnce(new Error('Network'));
      await usePhysicalEvaluationStore.getState().fetchEvaluations(10);
      expect(usePhysicalEvaluationStore.getState().error).toBe('No se pudieron cargar las evaluaciones físicas.');
      expect(usePhysicalEvaluationStore.getState().loading).toBe(false);
    });
  });

  describe('createEvaluation', () => {
    it('prepends new evaluation to list on success', async () => {
      usePhysicalEvaluationStore.setState({ evaluations: [MOCK_EVALUATION] });
      const newEval = { ...MOCK_EVALUATION, id: 2 };
      mockedApi.post.mockResolvedValueOnce({ data: newEval });
      const result = await usePhysicalEvaluationStore.getState().createEvaluation(10, MOCK_FORM_DATA);
      const state = usePhysicalEvaluationStore.getState();
      expect(result).toEqual(newEval);
      expect(state.evaluations).toHaveLength(2);
      expect(state.evaluations[0].id).toBe(2);
      expect(state.submitting).toBe(false);
    });

    it('returns null and sets error on failure', async () => {
      mockedApi.post.mockRejectedValueOnce(new Error('Network'));
      const result = await usePhysicalEvaluationStore.getState().createEvaluation(10, MOCK_FORM_DATA);
      expect(result).toBeNull();
      expect(usePhysicalEvaluationStore.getState().error).toBe('No se pudo guardar la evaluación física.');
      expect(usePhysicalEvaluationStore.getState().submitting).toBe(false);
    });

    it('extracts detail from error response', async () => {
      mockedApi.post.mockRejectedValueOnce({ response: { data: { detail: 'Validation failed.' } } });
      const result = await usePhysicalEvaluationStore.getState().createEvaluation(10, MOCK_FORM_DATA);
      expect(result).toBeNull();
      expect(usePhysicalEvaluationStore.getState().error).toBe('Validation failed.');
    });
  });

  describe('updateEvaluation', () => {
    it('updates evaluation in list on success', async () => {
      usePhysicalEvaluationStore.setState({ evaluations: [MOCK_EVALUATION] });
      const updated = { ...MOCK_EVALUATION, notes: 'Updated notes' };
      mockedApi.patch.mockResolvedValueOnce({ data: updated });
      const result = await usePhysicalEvaluationStore.getState().updateEvaluation(10, 1, { notes: 'Updated notes' });
      const state = usePhysicalEvaluationStore.getState();
      expect(result).toEqual(updated);
      expect(state.evaluations[0].notes).toBe('Updated notes');
      expect(state.submitting).toBe(false);
    });

    it('sets error on failure', async () => {
      mockedApi.patch.mockRejectedValueOnce(new Error('Network'));
      const result = await usePhysicalEvaluationStore.getState().updateEvaluation(10, 1, { notes: 'x' });
      expect(result).toBeNull();
      expect(usePhysicalEvaluationStore.getState().error).toBe('No se pudieron guardar los cambios.');
      expect(usePhysicalEvaluationStore.getState().submitting).toBe(false);
    });
  });

  describe('deleteEvaluation', () => {
    it('removes evaluation from list on success', async () => {
      usePhysicalEvaluationStore.setState({ evaluations: [MOCK_EVALUATION] });
      mockedApi.delete.mockResolvedValueOnce({});
      const result = await usePhysicalEvaluationStore.getState().deleteEvaluation(10, 1);
      expect(result).toBe(true);
      expect(usePhysicalEvaluationStore.getState().evaluations).toHaveLength(0);
      expect(usePhysicalEvaluationStore.getState().submitting).toBe(false);
    });

    it('sets error on failure', async () => {
      mockedApi.delete.mockRejectedValueOnce(new Error('Network'));
      const result = await usePhysicalEvaluationStore.getState().deleteEvaluation(10, 1);
      expect(result).toBe(false);
      expect(usePhysicalEvaluationStore.getState().error).toBe('No se pudo eliminar la evaluación.');
      expect(usePhysicalEvaluationStore.getState().submitting).toBe(false);
    });
  });

  describe('fetchMyEvaluations', () => {
    it('populates evaluations from customer endpoint', async () => {
      mockedApi.get.mockResolvedValueOnce({ data: [MOCK_EVALUATION] });
      await usePhysicalEvaluationStore.getState().fetchMyEvaluations();
      const state = usePhysicalEvaluationStore.getState();
      expect(state.evaluations).toHaveLength(1);
      expect(state.loading).toBe(false);
      expect(mockedApi.get).toHaveBeenCalledWith('/my-physical-evaluation/', {
        headers: { Authorization: 'Bearer fake-token' },
      });
    });

    it('sets error on failure', async () => {
      mockedApi.get.mockRejectedValueOnce(new Error('Network'));
      await usePhysicalEvaluationStore.getState().fetchMyEvaluations();
      expect(usePhysicalEvaluationStore.getState().error).toBe('No se pudieron cargar tus evaluaciones físicas.');
      expect(usePhysicalEvaluationStore.getState().loading).toBe(false);
    });
  });
});
