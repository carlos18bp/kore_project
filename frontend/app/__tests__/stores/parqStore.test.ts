import Cookies from 'js-cookie';
import { useParqStore } from '@/lib/stores/parqStore';
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
  },
}));

const mockedApi = api as jest.Mocked<typeof api>;

function resetStore() {
  useParqStore.setState({
    assessments: [],
    loading: false,
    submitting: false,
    error: '',
  });
}

const MOCK_ASSESSMENT = {
  id: 1,
  customer_id: 10,
  q1_heart_condition: false,
  q2_chest_pain: false,
  q3_dizziness: false,
  q4_chronic_condition: true,
  q5_prescribed_medication: false,
  q6_bone_joint_problem: false,
  q7_medical_supervision: false,
  additional_notes: 'Diabetes tipo 2',
  yes_count: 1,
  risk_classification: 'low',
  risk_label: 'Bajo',
  risk_color: 'green',
  created_at: '2025-01-15T12:00:00Z',
};

const MOCK_FORM_DATA = {
  q1_heart_condition: false,
  q2_chest_pain: false,
  q3_dizziness: false,
  q4_chronic_condition: true,
  q5_prescribed_medication: false,
  q6_bone_joint_problem: false,
  q7_medical_supervision: false,
  additional_notes: 'Diabetes tipo 2',
};

describe('parqStore', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    resetStore();
    (Cookies.get as jest.Mock).mockReturnValue('fake-token');
  });

  describe('fetchMyAssessments', () => {
    it('populates assessments on success', async () => {
      mockedApi.get.mockResolvedValueOnce({ data: [MOCK_ASSESSMENT] });
      await useParqStore.getState().fetchMyAssessments();
      const state = useParqStore.getState();
      expect(state.assessments).toHaveLength(1);
      expect(state.assessments[0].risk_classification).toBe('low');
      expect(state.loading).toBe(false);
      expect(mockedApi.get).toHaveBeenCalledWith('/my-parq/', {
        headers: { Authorization: 'Bearer fake-token' },
      });
    });

    it('sets error on failure', async () => {
      mockedApi.get.mockRejectedValueOnce(new Error('Network'));
      await useParqStore.getState().fetchMyAssessments();
      expect(useParqStore.getState().error).toBe('No se pudieron cargar tus evaluaciones PAR-Q.');
      expect(useParqStore.getState().loading).toBe(false);
    });

    it('sends empty auth headers when no token', async () => {
      (Cookies.get as jest.Mock).mockReturnValue(undefined);
      mockedApi.get.mockResolvedValueOnce({ data: [] });
      await useParqStore.getState().fetchMyAssessments();
      expect(mockedApi.get).toHaveBeenCalledWith('/my-parq/', { headers: {} });
    });
  });

  describe('createAssessment', () => {
    it('prepends new assessment to list on success', async () => {
      useParqStore.setState({ assessments: [MOCK_ASSESSMENT] });
      const newAssessment = { ...MOCK_ASSESSMENT, id: 2 };
      mockedApi.post.mockResolvedValueOnce({ data: newAssessment });
      const result = await useParqStore.getState().createAssessment(MOCK_FORM_DATA);
      const state = useParqStore.getState();
      expect(result).toEqual(newAssessment);
      expect(state.assessments).toHaveLength(2);
      expect(state.assessments[0].id).toBe(2);
      expect(state.submitting).toBe(false);
    });

    it('returns null and sets error on failure', async () => {
      mockedApi.post.mockRejectedValueOnce(new Error('Network'));
      const result = await useParqStore.getState().createAssessment(MOCK_FORM_DATA);
      expect(result).toBeNull();
      expect(useParqStore.getState().error).toBe('No se pudo guardar la evaluación PAR-Q.');
      expect(useParqStore.getState().submitting).toBe(false);
    });

    it('extracts detail from error response', async () => {
      mockedApi.post.mockRejectedValueOnce({ response: { data: { detail: 'Server error.' } } });
      const result = await useParqStore.getState().createAssessment(MOCK_FORM_DATA);
      expect(result).toBeNull();
      expect(useParqStore.getState().error).toBe('Server error.');
    });
  });

  describe('fetchClientAssessments', () => {
    it('populates assessments for a given client', async () => {
      mockedApi.get.mockResolvedValueOnce({ data: [MOCK_ASSESSMENT] });
      await useParqStore.getState().fetchClientAssessments(10);
      const state = useParqStore.getState();
      expect(state.assessments).toHaveLength(1);
      expect(state.loading).toBe(false);
      expect(mockedApi.get).toHaveBeenCalledWith('/trainer/my-clients/10/parq/', {
        headers: { Authorization: 'Bearer fake-token' },
      });
    });

    it('sets error on failure', async () => {
      mockedApi.get.mockRejectedValueOnce(new Error('Network'));
      await useParqStore.getState().fetchClientAssessments(10);
      expect(useParqStore.getState().error).toBe('No se pudieron cargar las evaluaciones PAR-Q.');
      expect(useParqStore.getState().loading).toBe(false);
    });
  });
});
